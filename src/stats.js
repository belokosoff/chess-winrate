(() => {
  const rec = () => ({ w: 0, d: 0, l: 0 });
  const count = (r) => r.w + r.d + r.l;
  const pct = (r) => (count(r) ? (r.w / count(r)) * 100 : null);
  const fmtPct = (p) => (p == null ? "—" : `${p.toFixed(1)}%`);

  function downsample(values, max) {
    if (values.length <= max) return values;
    const step = (values.length - 1) / (max - 1);
    return Array.from({ length: max }, (_, i) => values[Math.round(i * step)]);
  }

  // games отсортированы по времени по возрастанию.
  function filterGames(games, { period, mode }) {
    let out = mode === "all" ? games : games.filter((g) => g.k === mode);
    if (period === "30" || period === "90") {
      const from = Date.now() / 1000 - Number(period) * 86400;
      out = out.filter((g) => g.t >= from);
    } else if (period === "100") {
      out = out.slice(-100);
    }
    return out;
  }

  function aggregate(games) {
    const total = rec();
    const color = { w: rec(), b: rec() };
    const ops = { w: new Map(), b: new Map() };
    const endings = { w: {}, d: {}, l: {} };
    const hours = Array.from({ length: 6 }, rec);
    const days = Array.from({ length: 7 }, rec);

    for (const g of games) {
      total[g.o]++;
      color[g.c][g.o]++;
      if (g.e) {
        let r = ops[g.c].get(g.e);
        if (!r) ops[g.c].set(g.e, (r = rec()));
        r[g.o]++;
      }
      endings[g.o][g.h] = (endings[g.o][g.h] || 0) + 1;
      const d = new Date(g.t * 1000);
      hours[Math.floor(d.getHours() / 4)][g.o]++;
      days[(d.getDay() + 6) % 7][g.o]++;
    }

    const openings = (c) =>
      [...ops[c]]
        .map(([name, r]) => ({ name, rec: r, n: count(r) }))
        .filter((x) => x.n >= 3)
        .sort((a, b) => b.n - a.n)
        .slice(0, 8);

    return { total, color, openings: { w: openings("w"), b: openings("b") }, endings, hours, days };
  }

  function lastN(games, n) {
    const r = rec();
    for (const g of games.slice(-n)) r[g.o]++;
    return r;
  }

  function ratingSeries(games, mode) {
    let kind = mode;
    if (kind === "all") {
      const c = {};
      for (const g of games) c[g.k] = (c[g.k] || 0) + 1;
      kind = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
    }
    const values = games.filter((g) => g.k === kind && g.mr).map((g) => g.mr);
    return { mode: kind, values: downsample(values, 120) };
  }

  function rollingWinrate(games, win = 20) {
    const out = [];
    let wins = 0;
    games.forEach((g, i) => {
      if (g.o === "w") wins++;
      if (i >= win && games[i - win].o === "w") wins--;
      if (i >= win - 1) out.push((wins / win) * 100);
    });
    return downsample(out, 120);
  }

  // myGames: партии текущего пользователя; opp: ник соперника в нижнем регистре.
  function headToHead(myGames, opp) {
    const games = myGames.filter((g) => g.n === opp);
    const r = rec();
    for (const g of games) r[g.o]++;
    return { rec: r, recent: games.slice(-10).reverse() };
  }

  const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

  const BANDS = ["lt100", "lt30", "eq", "gt30", "gt100"];

  // Разница рейтинга соперника и вашего на момент партии.
  function bandOf(g) {
    const d = g.or - g.mr;
    return d < -100 ? "lt100" : d < -30 ? "lt30" : d <= 30 ? "eq" : d <= 100 ? "gt30" : "gt100";
  }

  function ratingBands(games) {
    const out = Object.fromEntries(BANDS.map((b) => [b, rec()]));
    for (const g of games) if (g.or && g.mr) out[bandOf(g)][g.o]++;
    return out;
  }

  // Доля отведённого времени, которую вы реально использовали (по часам из PGN).
  function timeUsage(games) {
    const withClock = games.filter((g) => g.us != null);
    const of = (o) => round1(mean(withClock.filter((g) => g.o === o).map((g) => g.us)));
    const buckets = [rec(), rec(), rec(), rec()]; // <25, 25-50, 50-75, >75
    for (const g of withClock) buckets[g.us < 25 ? 0 : g.us < 50 ? 1 : g.us < 75 ? 2 : 3][g.o]++;
    return {
      n: withClock.length,
      avg: round1(mean(withClock.map((g) => g.us))),
      win: of("w"),
      draw: of("d"),
      loss: of("l"),
      perMove: round1(mean(withClock.map((g) => g.sm))),
      buckets,
    };
  }

  // Точность есть только у партий, для которых на chess.com запускали разбор.
  function accuracy(games) {
    const withAcc = games.filter((g) => g.a != null);
    const of = (f) => round1(mean(withAcc.filter(f).map((g) => g.a)));
    const values = withAcc.map((g) => g.a);
    const rolling = [];
    values.forEach((_, i) => {
      if (i >= 9) rolling.push(mean(values.slice(i - 9, i + 1)));
    });
    return {
      n: withAcc.length,
      total: games.length,
      avg: round1(mean(values)),
      win: of((g) => g.o === "w"),
      draw: of((g) => g.o === "d"),
      loss: of((g) => g.o === "l"),
      white: of((g) => g.c === "w"),
      black: of((g) => g.c === "b"),
      series: downsample(rolling, 120),
    };
  }

  // "600" -> "10+0", "180+2" -> "3+2", "1/86400" -> "1d"
  function tcLabel(tc) {
    const d = /^1\/(\d+)$/.exec(tc || "");
    if (d) return `${Math.round(Number(d[1]) / 86400)}d`;
    const m = /^(\d+)(?:\+(\d+))?$/.exec(tc || "");
    if (!m) return null;
    const base = Number(m[1]);
    const mins = base % 60 === 0 ? String(base / 60) : (base / 60).toFixed(1);
    return `${base >= 60 ? mins : `${base}s`}+${m[2] || 0}`;
  }

  function byTimeControl(games, min = 3) {
    const map = new Map();
    for (const g of games) {
      const label = tcLabel(g.tc);
      if (!label) continue;
      let r = map.get(label);
      if (!r) map.set(label, (r = rec()));
      r[g.o]++;
    }
    return [...map]
      .map(([label, r]) => ({ label, rec: r, n: count(r) }))
      .filter((x) => x.n >= min)
      .sort((a, b) => b.n - a.n)
      .slice(0, 6);
  }

  // Лучшие и худшие дебюты (по цвету) среди сыгранных хотя бы `min` раз.
  function openingHighlights(games, min = 5) {
    const map = new Map();
    for (const g of games) {
      if (!g.e) continue;
      const key = `${g.c}|${g.e}`;
      let r = map.get(key);
      if (!r) map.set(key, (r = rec()));
      r[g.o]++;
    }
    const list = [...map]
      .map(([key, r]) => ({ color: key[0], name: key.slice(2), rec: r, n: count(r), pct: pct(r) }))
      .filter((x) => x.n >= min);
    return {
      worst: list.filter((x) => x.pct < 50).sort((a, b) => a.pct - b.pct || b.n - a.n).slice(0, 3),
      best: list.filter((x) => x.pct > 50).sort((a, b) => b.pct - a.pct || b.n - a.n).slice(0, 3),
    };
  }

  // Сессия: партии с паузами не больше `gap` секунд.
  function sessions(games, gap = 1800) {
    const out = [];
    let cur = [];
    games.forEach((g, i) => {
      if (i && g.t - games[i - 1].t > gap) {
        out.push(cur);
        cur = [];
      }
      cur.push(g);
    });
    if (cur.length) out.push(cur);
    return out;
  }

  function sessionStats(games) {
    const list = sessions(games);
    const pos = { "1–3": rec(), "4–6": rec(), "7+": rec() };
    const afterWin = rec();
    const afterLoss = rec();
    const afterTwoLosses = rec();
    for (const s of list) {
      s.forEach((g, i) => {
        pos[i < 3 ? "1–3" : i < 6 ? "4–6" : "7+"][g.o]++;
        if (i >= 1 && s[i - 1].o === "w") afterWin[g.o]++;
        if (i >= 1 && s[i - 1].o === "l") afterLoss[g.o]++;
        if (i >= 2 && s[i - 1].o === "l" && s[i - 2].o === "l") afterTwoLosses[g.o]++;
      });
    }
    return {
      count: list.length,
      avgLen: list.length ? round1(games.length / list.length) : null,
      longest: list.reduce((m, s) => Math.max(m, s.length), 0),
      pos,
      afterWin,
      afterLoss,
      afterTwoLosses,
    };
  }

  // Поражений подряд в конце, если последняя партия сыграна не раньше `maxAge` секунд назад.
  function lossStreak(games, now = Date.now() / 1000, maxAge = 3600) {
    if (!games.length || now - games.at(-1).t > maxAge) return 0;
    let n = 0;
    for (let i = games.length - 1; i >= 0 && games[i].o === "l"; i--) n++;
    return n;
  }

  function mainClass(games) {
    const c = {};
    for (const g of games) c[g.k] = (c[g.k] || 0) + 1;
    return Object.keys(c).sort((a, b) => c[b] - c[a])[0] ?? null;
  }

  // Последние 7 дней против предыдущих 7.
  function weekly(games, now = Date.now() / 1000) {
    const week = 7 * 86400;
    const sum = (arr) => {
      const r = rec();
      for (const g of arr) r[g.o]++;
      const cls = mainClass(arr);
      const rated = arr.filter((g) => g.k === cls && g.mr);
      return {
        n: arr.length,
        rec: r,
        pct: pct(r),
        timeUsed: timeUsage(arr).avg,
        acc: accuracy(arr).avg,
        cls,
        delta: rated.length >= 2 ? rated.at(-1).mr - rated[0].mr : null,
      };
    };
    return {
      cur: sum(games.filter((g) => g.t > now - week)),
      prev: sum(games.filter((g) => g.t <= now - week && g.t > now - 2 * week)),
    };
  }

  // Прогноз по наклону рейтинга за последние 50 партий основного режима.
  function goalProgress(games, mode, goal, now = Date.now() / 1000) {
    const cls = mode === "all" ? mainClass(games.slice(-100)) : mode;
    const list = games.filter((g) => g.k === cls && g.mr);
    if (!list.length) return null;
    const current = list.at(-1).mr;
    const recent = list.slice(-50);
    const slope = recent.length >= 10 ? (recent.at(-1).mr - recent[0].mr) / (recent.length - 1) : null;
    const spanDays = (recent.at(-1).t - recent[0].t) / 86400;
    const perDay = spanDays > 0 ? (recent.length - 1) / spanDays : null;
    const remaining = goal - current;
    const gamesNeeded = remaining > 0 && slope > 0 ? Math.ceil(remaining / slope) : null;
    return {
      cls,
      current,
      goal,
      remaining,
      reached: remaining <= 0,
      slope: slope == null ? null : round1(slope),
      gamesNeeded,
      days: gamesNeeded && perDay ? Math.ceil(gamesNeeded / perDay) : null,
      now,
    };
  }

  const recentLosses = (games, n = 15) => games.filter((g) => g.o === "l").slice(-n).reverse();

  const csvCell = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  function toCSV(games) {
    const head = ["date", "time_class", "color", "result", "ending", "opponent", "opponent_rating", "my_rating", "opening", "accuracy", "time_used_pct", "url"];
    const result = { w: "win", d: "draw", l: "loss" };
    const lines = games.map((g) =>
      [
        new Date(g.t * 1000).toISOString(),
        g.k,
        g.c === "w" ? "white" : "black",
        result[g.o],
        g.h,
        g.n,
        g.or,
        g.mr,
        g.e,
        g.a,
        g.us,
        g.u && `https://www.chess.com/${g.u}`,
      ]
        .map(csvCell)
        .join(","),
    );
    return [head.join(","), ...lines].join("\n");
  }

  Object.assign(CWR, {
    rec,
    count,
    pct,
    fmtPct,
    filterGames,
    aggregate,
    lastN,
    ratingSeries,
    rollingWinrate,
    headToHead,
    BANDS,
    ratingBands,
    timeUsage,
    accuracy,
    recentLosses,
    tcLabel,
    byTimeControl,
    openingHighlights,
    sessionStats,
    lossStreak,
    weekly,
    goalProgress,
    toCSV,
  });
})();
