(async () => {
  const TAGLINE = '[data-test-element="user-tagline-username"]';
  const REMOUNT_KEYS = ["lang", "panel", "badges", "months", "me", "theme", "goal"];

  let settings = await CWR.loadSettings();
  CWR.setLang(settings.lang);

  let panel = null;
  let panelKey = null;
  const pending = new Set();

  const BOARD = "wc-chess-board, chess-board";
  const GAME_PATH = /^\/(game|play|live|daily)(\/|$)/;

  // На странице партии ников десятки (списки партий, чат, боковые панели).
  // Игроки у доски: ближайший ник над ней и ближайший под ней.
  function boardPlayers() {
    if (!GAME_PATH.test(location.pathname)) return null;
    const board = document.querySelector(BOARD);
    const b = board?.getBoundingClientRect();
    if (!b?.width) {
      // Доску не нашли (вёрстка могла измениться): годится страница ровно с двумя видимыми никами.
      const visible = [...document.querySelectorAll(TAGLINE)].filter((el) => el.textContent.trim() && el.getBoundingClientRect().width);
      if (visible.length !== 2) return null;
      visible.sort((x, y) => x.getBoundingClientRect().top - y.getBoundingClientRect().top);
      return { top: visible[0], bottom: visible[1] };
    }
    let top = null;
    let bottom = null;
    for (const el of document.querySelectorAll(TAGLINE)) {
      const r = el.getBoundingClientRect();
      if (!r.width || !el.textContent.trim() || r.right < b.left || r.left > b.right) continue;
      if (r.bottom <= b.top + 8) {
        if (!top || r.bottom > top.getBoundingClientRect().bottom) top = el;
      } else if (r.top >= b.bottom - 8) {
        if (!bottom || r.top < bottom.getBoundingClientRect().top) bottom = el;
      }
    }
    return top && bottom ? { top, bottom } : null;
  }

  const nameOf = (el) => el.textContent.trim().toLowerCase();

  // Профиль (/member/ник) или партия (игроки у доски; нижний считается мной).
  function detectContext() {
    const me = settings.me.trim().toLowerCase();
    const m = location.pathname.match(/^\/member\/([^/]+)/);
    if (m) return { kind: "profile", user: decodeURIComponent(m[1]).toLowerCase(), me };

    // Главная: ваша собственная статистика, если указан ник.
    if (/^\/(home)?\/?$/.test(location.pathname)) return CWR.api.isValidUser(me) ? { kind: "profile", user: me, me } : null;

    const players = boardPlayers();
    if (!players) return null;
    const top = nameOf(players.top);
    const bottom = nameOf(players.bottom);
    const self = me || bottom;
    const opponent = top === self ? bottom : top;
    if (!CWR.api.isValidUser(opponent)) return null; // бот или гость
    return { kind: "game", user: opponent, me: CWR.api.isValidUser(self) ? self : "" };
  }

  function syncPanel() {
    const ctx = settings.panel ? detectContext() : null;
    const key = ctx ? `${ctx.kind}|${ctx.user}|${ctx.me}` : null;
    if (key === panelKey) return;
    panel?.destroy();
    panel = ctx ? CWR.mountPanel(ctx, settings) : null;
    panelKey = key;
  }

  async function addBadge(el) {
    const id = nameOf(el);
    if (pending.has(id)) return;
    pending.add(id);
    try {
      const stats = await CWR.api.getStats(id);
      if (!stats || !el.isConnected) return;
      const sum = CWR.rec();
      const parts = [];
      for (const m of ["rapid", "blitz", "bullet", "daily"]) {
        const r = stats[`chess_${m}`]?.record;
        if (!r) continue;
        sum.w += r.win;
        sum.d += r.draw;
        sum.l += r.loss;
        parts.push(`${CWR.t(m)}: ${CWR.fmtPct(CWR.pct({ w: r.win, d: r.draw, l: r.loss }))}`);
      }
      el.nextElementSibling?.classList.contains("cwr-badge") && el.nextElementSibling.remove();
      const badge = document.createElement("span");
      badge.className = "cwr-badge";
      badge.dataset.user = id;
      badge.textContent = `WR ${CWR.fmtPct(CWR.pct(sum))}`;
      badge.title = parts.join("\n");
      el.after(badge);
    } catch (e) {
      console.debug("[chess-winrate]", e);
    } finally {
      pending.delete(id);
    }
  }

  function syncBadges() {
    const players = settings.badges ? boardPlayers() : null;
    if (!players) {
      document.querySelectorAll(".cwr-badge").forEach((b) => b.remove());
      return;
    }
    for (const el of [players.top, players.bottom]) {
      const id = nameOf(el);
      if (CWR.api.isValidUser(id) && el.nextElementSibling?.dataset.user !== id) addBadge(el);
    }
  }

  function scan() {
    syncPanel();
    syncBadges();
  }

  let timer = null;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(scan, 500);
  }).observe(document.body, { childList: true, subtree: true });

  CWR.onSettingsChanged((next) => {
    const needsRemount = REMOUNT_KEYS.some((k) => next[k] !== settings[k]);
    settings = next;
    if (!needsRemount) return;
    CWR.setLang(settings.lang);
    document.querySelectorAll(".cwr-badge").forEach((b) => b.remove());
    panel?.destroy();
    panel = null;
    panelKey = null;
    scan();
  });

  // Alt+W сворачивает и разворачивает панель.
  document.addEventListener("keydown", (e) => {
    if (!panel || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.code !== "KeyW") return;
    const el = document.activeElement;
    if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
    e.preventDefault();
    panel.toggle();
  });

  scan();
})();
