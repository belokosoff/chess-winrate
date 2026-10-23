(() => {
  const BASE = "https://api.chess.com/pub";
  const SHORT_TTL = 5 * 60 * 1000;
  const LONG_TTL = 60 * 60 * 1000;
  const FORMAT = 3; // версия сжатой записи партии; при смене старый кэш месяцев перезагружается

  const DRAWS = new Set(["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"]);
  const ENDING = {
    checkmated: "mate",
    timeout: "time",
    resigned: "resign",
    abandoned: "abandon",
    agreed: "agreed",
    repetition: "repetition",
    stalemate: "stalemate",
    insufficient: "insufficient",
    timevsinsufficient: "insufficient",
    "50move": "50move",
  };
  const FAMILY_END = new Set(["Defense", "Game", "Opening", "Gambit", "Attack", "System", "Variation", "Countergambit"]);

  const VALID_USER = /^[A-Za-z0-9_-]{2,25}$/;

  // Кэш ответов лежит в storage.local (квота браузера ~5–10 МБ). Держим его в бюджете и выбрасываем давно не нужные записи.
  const CACHE_BUDGET = 4 * 1024 * 1024;
  const CACHE_KEY = /^[psam]:/;
  const DAY = 24 * 60 * 60 * 1000;

  const inflight = new Map();
  const missing = new Map(); // key -> когда ответ был "нет данных"; повторно не спрашиваем
  let pruneTimer = null;

  // Удаляет записи, к которым давно не обращались (поле u, иначе время загрузки t), пока кэш не уменьшится до 75% бюджета.
  async function prune(budget = CACHE_BUDGET) {
    const all = await CWR.ext.storage.local.get(null);
    const entries = Object.entries(all)
      .filter(([k]) => CACHE_KEY.test(k))
      .map(([k, v]) => ({ k, size: k.length + JSON.stringify(v).length, used: v.u ?? v.t ?? 0 }));
    let total = entries.reduce((sum, e) => sum + e.size, 0);
    if (total <= budget) return 0;
    const drop = [];
    for (const e of entries.sort((a, b) => a.used - b.used)) {
      if (total <= budget * 0.75) break;
      drop.push(e.k);
      total -= e.size;
    }
    await CWR.ext.storage.local.remove(drop);
    return drop.length;
  }

  function schedulePrune() {
    if (pruneTimer) return;
    pruneTimer = setTimeout(() => {
      pruneTimer = null;
      prune().catch((e) => console.debug("[chess-winrate] prune failed", e));
    }, 5000);
  }

  // Запись в кэш; при нехватке места чистим старое и пробуем ещё раз.
  async function put(key, value) {
    try {
      await CWR.ext.storage.local.set({ [key]: value });
    } catch {
      try {
        await prune(CACHE_BUDGET / 2);
        await CWR.ext.storage.local.set({ [key]: value });
      } catch (e) {
        console.debug("[chess-winrate] cache write failed", e);
      }
    }
    schedulePrune();
  }

  async function getJSON(url) {
    let res;
    try {
      res = await fetch(url);
    } catch {
      // Закрытые аккаунты отвечают 410 без CORS-заголовков, браузер показывает это как сетевую ошибку.
      return null;
    }
    if (res.status === 404 || res.status === 410) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function cached(key, ttl, load) {
    const miss = missing.get(key);
    if (miss && Date.now() - miss < SHORT_TTL) return null;
    const got = (await CWR.ext.storage.local.get(key))[key];
    if (got && Date.now() - got.t < ttl) return got.v;
    if (inflight.has(key)) return inflight.get(key);
    const p = (async () => {
      const v = await load();
      if (v === null) missing.set(key, Date.now());
      else await put(key, { t: Date.now(), v });
      return v;
    })().finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }

  // "Sicilian-Defense-Open-Najdorf-6.Bg5" -> "Sicilian Defense"
  function openingFamily(slug) {
    let words;
    try {
      words = decodeURIComponent(slug).split("-");
    } catch {
      words = slug.split("-");
    }
    const out = [];
    for (const w of words) {
      if (/\d|\.\.\./.test(w)) break;
      out.push(w);
      if (FAMILY_END.has(w) || out.length >= 3) break;
    }
    return out.join(" ") || null;
  }

  function openingOf(g) {
    let url = g.eco;
    if (!url && g.pgn) url = g.pgn.match(/\[ECOUrl "([^"]+)"\]/)?.[1];
    return url ? openingFamily(url.split("/").pop()) : null;
  }

  // Сколько отведённого времени игрок израсходовал по [%clk] в PGN. Только для контроля вида "600" или "180+2".
  function clockStats(pgn, isWhite, timeControl) {
    const m = /^(\d+)(?:\+(\d+))?$/.exec(timeControl || "");
    if (!m || !pgn) return null;
    const base = Number(m[1]);
    const inc = Number(m[2] || 0);
    const clocks = [...pgn.matchAll(/\[%clk (\d+):(\d+):([\d.]+)\]/g)].map((x) => +x[1] * 3600 + +x[2] * 60 + +x[3]);
    const mine = clocks.filter((_, i) => (i % 2 === 0) === isWhite);
    if (mine.length < 3) return null;
    const budget = base + inc * mine.length;
    const used = Math.min(budget, Math.max(0, budget - mine.at(-1)));
    return { us: Math.round((used / budget) * 100), sm: Math.round((used / mine.length) * 10) / 10 };
  }

  // "game/live/123456" -> ссылка на разбор строится в интерфейсе
  function gamePath(url) {
    const p = String(url || "").replace(/^https:\/\/www\.chess\.com\//, "");
    return /^game\/(live|daily)\/\d+$/.test(p) ? p : null;
  }

  // Полную запись партии (с PGN) храним в сжатом виде: ~150 байт на партию.
  function compact(g, me) {
    if (g.rules && g.rules !== "chess") return null;
    const white = g.white;
    const black = g.black;
    if (!white?.username || !black?.username) return null;
    const isWhite = white.username.toLowerCase() === me;
    const mine = isWhite ? white : black;
    const theirs = isWhite ? black : white;
    const outcome = mine.result === "win" ? "w" : DRAWS.has(mine.result) ? "d" : "l";
    const how = outcome === "w" ? theirs.result : mine.result;
    const acc = g.accuracies?.[isWhite ? "white" : "black"];
    return {
      ...clockStats(g.pgn, isWhite, g.time_control),
      a: typeof acc === "number" ? Math.round(acc * 10) / 10 : null,
      u: gamePath(g.url),
      tc: g.time_control || null,
      t: g.end_time,
      c: isWhite ? "w" : "b",
      o: outcome,
      h: ENDING[how] || "other",
      k: g.time_class,
      n: theirs.username.toLowerCase(),
      or: theirs.rating,
      mr: mine.rating,
      e: openingOf(g),
    };
  }

  CWR.api = {
    compact,
    openingFamily,
    clockStats,
    prune,
    isValidUser: (user) => VALID_USER.test(user),

    getProfile: async (user) =>
      VALID_USER.test(user) ? cached(`p:${user}`, LONG_TTL, () => getJSON(`${BASE}/player/${encodeURIComponent(user)}`)) : null,

    getStats: async (user) =>
      VALID_USER.test(user) ? cached(`s:${user}`, SHORT_TTL, () => getJSON(`${BASE}/player/${encodeURIComponent(user)}/stats`)) : null,

    async getArchives(user) {
      if (!VALID_USER.test(user)) return [];
      const data = await cached(`a:${user}`, LONG_TTL, () => getJSON(`${BASE}/player/${encodeURIComponent(user)}/games/archives`));
      return data?.archives ?? [];
    },

    async getMonth(user, url) {
      const m = url.match(/(\d{4})\/(\d{2})$/);
      const key = `m:${user}:${m[1]}/${m[2]}`;
      const now = new Date();
      const isCurrent = +m[1] === now.getUTCFullYear() && +m[2] === now.getUTCMonth() + 1;
      const got = (await CWR.ext.storage.local.get(key))[key];
      if (got && got.v.ver === FORMAT && (got.v.final || Date.now() - got.t < SHORT_TTL)) {
        // отмечаем, что запись нужна, но не чаще раза в сутки, чтобы не писать в хранилище при каждом просмотре
        if (Date.now() - (got.u ?? got.t) > DAY) put(key, { ...got, u: Date.now() });
        return got.v.games;
      }
      const data = await getJSON(url);
      if (!data) return []; // сбой или пустой ответ не кэшируем: иначе прошлый месяц навсегда останется пустым
      const games = (data.games ?? []).map((g) => compact(g, user)).filter(Boolean);
      await put(key, { t: Date.now(), u: Date.now(), v: { final: !isCurrent, games, ver: FORMAT } });
      return games;
    },

    // Грузит последние `months` месяцев по 3 запроса параллельно.
    async loadGames(user, months, onProgress) {
      const archives = (await CWR.api.getArchives(user)).slice(-months);
      const out = [];
      let done = 0;
      let next = 0;
      onProgress?.(0, archives.length);
      const worker = async () => {
        while (next < archives.length) {
          const url = archives[next++];
          out.push(...(await CWR.api.getMonth(user, url)));
          onProgress?.(++done, archives.length);
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, archives.length) }, worker));
      return out.sort((a, b) => a.t - b.t);
    },

    async clearCache() {
      const all = await CWR.ext.storage.local.get(null);
      const keys = Object.keys(all).filter((k) => CACHE_KEY.test(k));
      await CWR.ext.storage.local.remove(keys);
      return keys.length;
    },
  };
})();
