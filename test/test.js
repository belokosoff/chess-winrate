// node test/test.js — проверяет логику без браузера: сжатие партий, агрегаты, CSV, загрузку с кэшем.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const store = {};
const ext = {
  storage: {
    local: {
      async get(k) {
        if (k === null) return { ...store };
        return k in store ? { [k]: store[k] } : {};
      },
      async set(o) { Object.assign(store, JSON.parse(JSON.stringify(o))); },
      async remove(keys) { for (const k of keys) delete store[k]; },
    },
    onChanged: { addListener() {} },
  },
};

const month = (y, m) => `https://api.chess.com/pub/player/me/games/${y}/${String(m).padStart(2, "0")}`;
let fetches = [];
const game = (over = {}) => ({
  end_time: 1_700_000_000,
  rules: "chess",
  time_class: "blitz",
  eco: "https://www.chess.com/openings/Sicilian-Defense-Open-Najdorf-Variation-6.Bg5-e6",
  white: { username: "Me", rating: 1500, result: "win" },
  black: { username: "Foe", rating: 1480, result: "checkmated" },
  ...over,
});
const archivesBody = { archives: [month(2024, 1), month(2024, 2), month(2024, 3)] };
const monthBodies = {
  [month(2024, 1)]: { games: [game(), game({ white: { username: "Foe", rating: 1400, result: "timeout" }, black: { username: "ME", rating: 1510, result: "win" }, end_time: 1_700_000_100 })] },
  [month(2024, 2)]: { games: [game({ white: { username: "Me", rating: 1500, result: "resigned" }, black: { username: "Foe", rating: 1500, result: "win" }, end_time: 1_700_000_200 })] },
  [month(2024, 3)]: { games: [
    game({ rules: "chess960" }),
    game({ white: { username: "Me", rating: 1500, result: "agreed" }, black: { username: "Foe", rating: 1500, result: "agreed" }, eco: undefined, pgn: '[ECOUrl "https://www.chess.com/openings/Italian-Game-Two-Knights-Defense"]', time_class: "rapid", end_time: 1_700_000_300 }),
  ] },
};

const ctx = {
  navigator: { language: "ru-RU" },
  console,
  setTimeout,
  decodeURIComponent,
  fetch: async (url) => {
    fetches.push(url);
    const body = url.endsWith("/games/archives") ? archivesBody : monthBodies[url];
    return body ? { ok: true, status: 200, json: async () => body } : { ok: false, status: 404 };
  },
};
ctx.globalThis = ctx;
vm.createContext(ctx);
ctx.CWR = { ext };
for (const f of ["locales", "i18n", "settings", "api", "stats"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", `${f}.js`), "utf8"), ctx, { filename: f });
}
const { CWR } = ctx;

(async () => {
  // opening families
  assert.equal(CWR.api.openingFamily("Sicilian-Defense-Open-Najdorf-Variation-6.Bg5-e6"), "Sicilian Defense");
  assert.equal(CWR.api.openingFamily("Queens-Gambit-Declined-Slav"), "Queens Gambit");
  assert.equal(CWR.api.openingFamily("Caro-Kann-Defense-Advance-Variation"), "Caro Kann Defense");
  assert.equal(CWR.api.openingFamily("Italian-Game-Two-Knights-Defense"), "Italian Game");
  assert.equal(CWR.api.openingFamily("Zukertort-Opening-Kingside-Fianchetto-3.Bg2"), "Zukertort Opening");
  assert.equal(CWR.api.openingFamily("Kings-Pawn-Opening-1...e5"), "Kings Pawn Opening");

  // compact: win as white by mate, win as black on time, loss by resign, draw agreed, variant skipped
  const a = CWR.api.compact(game(), "me");
  assert.deepEqual({ c: a.c, o: a.o, h: a.h, n: a.n, e: a.e }, { c: "w", o: "w", h: "mate", n: "foe", e: "Sicilian Defense" });
  const b = CWR.api.compact(monthBodies[month(2024, 1)].games[1], "me");
  assert.deepEqual({ c: b.c, o: b.o, h: b.h, mr: b.mr }, { c: "b", o: "w", h: "time", mr: 1510 });
  const c = CWR.api.compact(monthBodies[month(2024, 2)].games[0], "me");
  assert.deepEqual({ o: c.o, h: c.h }, { o: "l", h: "resign" });
  assert.equal(CWR.api.compact(monthBodies[month(2024, 3)].games[0], "me"), null);

  // loadGames: sorted, limited by months, cached
  let progress = [];
  const games = await CWR.api.loadGames("me", 3, (d, t) => progress.push([d, t]));
  assert.equal(games.length, 4);
  const ts = Array.from(games, (g) => g.t);
  assert.deepEqual(ts, [...ts].sort((x, y) => x - y));
  assert.equal(games.at(-1).e, "Italian Game");
  assert.deepEqual(Array.from(progress.at(-1)), [3, 3]);
  const last2 = await CWR.api.loadGames("me", 2);
  assert.equal(last2.length, 2);
  const before = fetches.length;
  await CWR.api.loadGames("me", 3); // past months are final -> served from cache
  assert.equal(fetches.length, before + 0, "no new requests for final months");

  // aggregates
  const agg = CWR.aggregate(games);
  assert.deepEqual({ ...agg.total }, { w: 2, d: 1, l: 1 });
  assert.deepEqual({ ...agg.color.w }, { w: 1, d: 1, l: 1 });
  assert.equal(CWR.fmtPct(CWR.pct(agg.total)), "50.0%");
  assert.equal(agg.endings.w.mate, 1);
  assert.equal(agg.endings.w.time, 1);
  assert.equal(agg.endings.l.resign, 1);
  assert.equal(agg.endings.d.agreed, 1);
  assert.equal(agg.hours.reduce((s, r) => s + CWR.count(r), 0), 4);
  assert.equal(agg.days.reduce((s, r) => s + CWR.count(r), 0), 4);
  assert.equal(agg.openings.w.length, 0, "needs >= 3 games per opening");

  // filters
  assert.equal(CWR.filterGames(games, { period: "all", mode: "rapid" }).length, 1);
  assert.equal(CWR.filterGames(games, { period: "100", mode: "all" }).length, 4);
  assert.equal(CWR.filterGames(games, { period: "30", mode: "all" }).length, 0);
  assert.equal(CWR.rollingWinrate(games, 2).length, 3);
  assert.equal(CWR.ratingSeries(games, "all").mode, "blitz");

  // head to head
  const hh = CWR.headToHead(games, "foe");
  assert.deepEqual({ ...hh.rec }, { w: 2, d: 1, l: 1 });
  assert.equal(hh.recent[0].t, games.at(-1).t);

  // csv
  const csv = CWR.toCSV(games);
  assert.equal(csv.split("\n").length, 5);
  assert.match(csv.split("\n")[0], /^date,time_class,color,result,ending,opponent/);

  // i18n
  CWR.setLang("auto");
  assert.equal(CWR.t("last_n", 20), "Последние 20");
  CWR.setLang("en");
  assert.equal(CWR.t("last_n", 20), "Last 20");

  // every language has exactly the keys of the Russian dictionary, with the same {n} placeholders
  const ru = CWR.dictionary("ru");
  const placeholders = (str) => Array.from(str.matchAll(/\{\d+\}/g), (m) => m[0]).sort().join();
  assert.deepEqual(Array.from(CWR.languages()).sort(), ["de", "en", "es", "fr", "ru"]);
  for (const code of CWR.languages()) {
    const dict = CWR.dictionary(code);
    assert.deepEqual(Object.keys(dict).sort(), Object.keys(ru).sort(), `keys differ in ${code}`);
    for (const [key, value] of Object.entries(dict)) {
      assert.ok(value.trim(), `${code}.${key} is empty`);
      assert.equal(placeholders(value), placeholders(ru[key]), `${code}.${key} placeholders`);
    }
    assert.equal(dict.weekdays.split(",").length, 7, `${code} weekdays`);
  }
  CWR.setLang("es");
  assert.equal(CWR.t("last_n", 20), "Últimas 20");
  CWR.setLang("de");
  assert.equal(CWR.t("goal_eta_v", 5, 3), "≈ 5 Partien (~3 Tage)");
  CWR.setLang("xx"); // unknown preference falls back to the browser language ("ru-RU" in this test)
  assert.equal(CWR.lang(), "ru");

  // clock usage, accuracy, game link
  const pgn =
    "1. e4 {[%clk 0:09:58.0]} 1... e5 {[%clk 0:09:59.0]} 2. Nf3 {[%clk 0:09:30.0]} 2... Nc6 {[%clk 0:09:50.0]} " +
    "3. Bc4 {[%clk 0:05:00.0]} 3... Bc5 {[%clk 0:09:40.0]}";
  assert.deepEqual({ ...CWR.api.clockStats(pgn, true, "600") }, { us: 50, sm: 100 });
  assert.equal(CWR.api.clockStats(pgn, false, "600").us, 3);
  assert.equal(CWR.api.clockStats(pgn, true, "1/86400"), null, "daily games have no clock budget");
  assert.equal(CWR.api.clockStats("1. e4 e5", true, "600"), null);
  const withExtras = CWR.api.compact(
    game({ pgn, time_control: "600", accuracies: { white: 71.26, black: 60 }, url: "https://www.chess.com/game/live/123" }),
    "me",
  );
  assert.deepEqual({ us: withExtras.us, a: withExtras.a, u: withExtras.u }, { us: 50, a: 71.3, u: "game/live/123" });
  assert.equal(CWR.api.compact(game({ url: "https://evil.example/x" }), "me").u, null);
  assert.equal(CWR.api.compact(game(), "me").a, null);

  const rg = (o, or, mr, extra = {}) => ({ t: 1, c: "w", o, h: "resign", k: "rapid", n: "x", or, mr, ...extra });
  const bandGames = [rg("w", 1300, 1500), rg("w", 1480, 1500), rg("l", 1520, 1500), rg("l", 1600, 1500), rg("l", 1700, 1500)];
  const bands = CWR.ratingBands(bandGames);
  assert.deepEqual(
    Array.from(CWR.BANDS, (b) => CWR.count(bands[b])),
    [1, 0, 2, 1, 1],
  );
  const tu = CWR.timeUsage([rg("w", 1, 1, { us: 20, sm: 5 }), rg("l", 1, 1, { us: 60, sm: 15 }), rg("l", 1, 1)]);
  assert.equal(tu.n, 2);
  assert.equal(tu.avg, 40);
  assert.equal(tu.loss, 60);
  assert.equal(tu.perMove, 10);
  assert.deepEqual(Array.from(tu.buckets, (b) => b.w + b.l), [1, 0, 1, 0]);
  const acc = CWR.accuracy([rg("w", 1, 1, { a: 80 }), rg("l", 1, 1, { a: 60, c: "b" }), rg("l", 1, 1)]);
  assert.deepEqual({ n: acc.n, total: acc.total, avg: acc.avg, win: acc.win, loss: acc.loss, black: acc.black }, { n: 2, total: 3, avg: 70, win: 80, loss: 60, black: 60 });
  assert.equal(CWR.accuracy([]).avg, null);
  const losses = CWR.recentLosses([rg("l", 1, 1, { t: 1 }), rg("w", 1, 1, { t: 2 }), rg("l", 1, 1, { t: 3 })]);
  assert.deepEqual(Array.from(losses, (g) => g.t), [3, 1]);
  assert.match(CWR.toCSV([rg("l", 1, 1, { a: 55.5, us: 40, u: "game/live/9" })]), /55\.5,40,https:\/\/www\.chess\.com\/game\/live\/9/);

  // time controls
  assert.equal(CWR.tcLabel("600"), "10+0");
  assert.equal(CWR.tcLabel("180+2"), "3+2");
  assert.equal(CWR.tcLabel("900+10"), "15+10");
  assert.equal(CWR.tcLabel("30"), "30s+0");
  assert.equal(CWR.tcLabel("1/259200"), "3d");
  assert.equal(CWR.tcLabel("-"), null);
  assert.equal(CWR.api.compact(game({ time_control: "180+2" }), "me").tc, "180+2");
  const tcs = CWR.byTimeControl([rg("w", 1, 1, { tc: "600" }), rg("l", 1, 1, { tc: "600" }), rg("w", 1, 1, { tc: "600" }), rg("w", 1, 1, { tc: "180" })]);
  assert.deepEqual(Array.from(tcs, (x) => [x.label, x.n]), [["10+0", 3]], "labels with < 3 games are hidden");

  // weak / strong openings
  const og = (o, e, c = "w") => rg(o, 1, 1, { e, c });
  const hl = CWR.openingHighlights([
    ...Array.from({ length: 5 }, () => og("l", "Scotch Game")),
    ...Array.from({ length: 5 }, () => og("w", "Italian Game")),
    ...Array.from({ length: 4 }, () => og("l", "Rare Opening")),
  ]);
  assert.deepEqual(Array.from(hl.worst, (x) => x.name), ["Scotch Game"]);
  assert.deepEqual(Array.from(hl.best, (x) => x.name), ["Italian Game"]);

  // sessions and loss streaks (gap > 30 min starts a new session)
  const at = (t, o) => rg(o, 1, 1, { t });
  const sg = [at(0, "w"), at(60, "l"), at(120, "l"), at(180, "w"), at(10000, "l"), at(10060, "l"), at(10120, "l")];
  const ss = CWR.sessionStats(sg);
  assert.equal(ss.count, 2);
  assert.equal(ss.longest, 4);
  assert.equal(CWR.count(ss.afterTwoLosses), 2);
  assert.equal(ss.afterTwoLosses.w, 1);
  assert.equal(CWR.lossStreak(sg, 10200), 3);
  assert.equal(CWR.lossStreak(sg, 10120 + 7200), 0, "an old streak is not shown");
  assert.equal(CWR.lossStreak([], 0), 0);

  // week over week
  const DAY = 86400;
  const now = 100 * DAY;
  const wk = CWR.weekly(
    [at(now - 10 * DAY, "l"), at(now - 9 * DAY, "w"), at(now - 2 * DAY, "w"), at(now - DAY, "w"), at(now - 1000, "l")].map((g, i) => ({ ...g, mr: 1000 + i * 10 })),
    now,
  );
  assert.deepEqual({ cur: wk.cur.n, prev: wk.prev.n }, { cur: 3, prev: 2 });
  assert.equal(wk.cur.pct.toFixed(1), "66.7");
  assert.equal(wk.cur.delta, 20);

  // goal progress
  const climb = Array.from({ length: 20 }, (_, i) => rg("w", 1, 1, { t: now - (20 - i) * 3600, mr: 400 + i * 2 }));
  const gp = CWR.goalProgress(climb, "all", 450, now);
  assert.equal(gp.current, 438);
  assert.equal(gp.remaining, 12);
  assert.equal(gp.slope, 2);
  assert.equal(gp.gamesNeeded, 6);
  assert.ok(gp.days >= 1);
  assert.equal(CWR.goalProgress(climb, "all", 400, now).reached, true);
  const flat = climb.map((g) => ({ ...g, mr: 400 }));
  assert.equal(CWR.goalProgress(flat, "all", 450, now).gamesNeeded, null);
  assert.equal(CWR.goalProgress([], "all", 450, now), null);

  // calendar: 26 weeks x 7 days, Monday first, no cells after today
  const todayMs = new Date(2026, 9, 23, 12).getTime(); // Friday
  const stamp = (y, m, d, h = 10) => Math.floor(new Date(y, m, d, h).getTime() / 1000);
  const calGames = [
    rg("w", 1, 1, { t: stamp(2026, 9, 23) }),
    rg("w", 1, 1, { t: stamp(2026, 9, 23, 18) }),
    rg("l", 1, 1, { t: stamp(2026, 9, 22) }),
    rg("l", 1, 1, { t: stamp(2020, 0, 1) }), // far outside the window
  ];
  const cal = CWR.calendar(calGames, 26, todayMs);
  assert.equal(cal.length, 26);
  assert.ok(cal.every((w) => w.length === 7));
  const lastWeek = cal.at(-1);
  assert.equal(lastWeek[0].date.getDay(), 1, "weeks start on Monday");
  assert.deepEqual(Array.from(lastWeek, (c) => c === null), [false, false, false, false, false, true, true], "Mon-Fri exist, Sat-Sun are in the future");
  assert.deepEqual({ n: lastWeek[4].n, pct: lastWeek[4].pct }, { n: 2, pct: 100 });
  assert.deepEqual({ n: lastWeek[3].n, pct: lastWeek[3].pct }, { n: 1, pct: 0 });
  assert.equal(cal.flat().filter((c) => c && c.n).length, 2, "old games fall outside the window");

  // old cached months (without the new fields) are refetched once
  const mkey = Object.keys(store).find((k) => k.startsWith("m:me:"));
  store[mkey].v.ver = 1;
  const f0 = fetches.length;
  await CWR.api.loadGames("me", 3);
  assert.ok(fetches.length > f0, "outdated cache format triggers a refetch");

  // invalid usernames never hit the network; failed lookups (410 without CORS = thrown fetch) are remembered
  const n0 = fetches.length;
  assert.equal(await CWR.api.getStats("loch chess monster"), null);
  assert.equal(CWR.api.isValidUser("Guest 1"), false);
  assert.equal(CWR.api.isValidUser("some_user-1"), true);
  assert.equal(fetches.length, n0);
  const realFetch = ctx.fetch;
  let thrown = 0;
  ctx.fetch = async () => { thrown++; throw new TypeError("NetworkError"); };
  assert.equal(await CWR.api.getStats("ghost"), null);
  assert.equal(await CWR.api.getStats("ghost"), null);
  assert.equal(thrown, 1, "a failed lookup is not retried on every call");
  ctx.fetch = realFetch;

  // cache pruning drops the least recently used entries and never touches settings
  for (const k of Object.keys(store)) delete store[k];
  const filler = (u) => ({ t: 1, u, v: "x".repeat(1000) });
  store["m:me:2020/01"] = filler(1);
  store["m:me:2020/02"] = filler(2);
  store["m:me:2020/03"] = filler(3);
  store.settings = { lang: "en" };
  assert.equal(await CWR.api.prune(100_000), 0, "nothing is dropped within the budget");
  assert.equal(await CWR.api.prune(2500), 2);
  assert.deepEqual(Object.keys(store).sort(), ["m:me:2020/03", "settings"]);

  // a failed write (quota) prunes and retries once; the games are still returned
  const realSet = ext.storage.local.set;
  let failures = 1;
  ext.storage.local.set = async (o) => {
    if (failures-- > 0) throw new Error("QuotaExceededError");
    return realSet(o);
  };
  const retried = await CWR.api.getMonth("me", month(2024, 1));
  ext.storage.local.set = realSet;
  assert.equal(retried.length, 2);
  assert.ok(store["m:me:2024/01"], "the entry is stored on the retry");

  // clear cache keeps settings
  await CWR.saveSettings({ me: "me" });
  await CWR.api.clearCache();
  assert.ok(!Object.keys(store).some((k) => /^[psam]:/.test(k)));
  assert.equal((await CWR.loadSettings()).me, "me");

  console.log("all tests passed");
  process.exit(0); // отложенная очистка кэша держит процесс ещё 5 секунд
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
