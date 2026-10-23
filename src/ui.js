(() => {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const MODES = ["rapid", "blitz", "bullet", "daily"];
  const TABS = ["overview", "openings", "endings", "time", "trend", "insights", "losses", "compare", "h2h"];
  const ENDINGS = ["mate", "time", "resign", "abandon", "agreed", "repetition", "stalemate", "insufficient", "50move", "other"];
  const HOURS = ["00–04", "04–08", "08–12", "12–16", "16–20", "20–24"];
  const BUCKETS = ["<25%", "25–50%", "50–75%", ">75%"];

  // Данные игроков попадают в DOM только через textContent / CSSOM.
  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style") Object.assign(el.style, v);
      else if (k === "value") el.value = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    el.append(...kids.flat().filter((x) => x != null && x !== false));
    return el;
  }

  const t = (...a) => CWR.t(...a);
  const kv = (label, value) => h("div", { class: "cwr-kv" }, h("span", {}, label), h("b", {}, value));
  const sub = (text) => h("div", { class: "cwr-sub" }, text);
  const muted = (text) => h("div", { class: "cwr-muted" }, text);
  const tip = (text) => h("div", { class: "cwr-tip" }, text);
  const num = (v, suffix = "") => (v == null ? "—" : `${v}${suffix}`);
  const signed = (v) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v}`);

  function statRow(label, r, hint) {
    const n = CWR.count(r);
    const seg = (cls, v) => h("i", { class: `cwr-seg ${cls}`, style: { width: `${n ? (v / n) * 100 : 0}%` } });
    return h(
      "div",
      { class: "cwr-row" },
      h("span", { class: "cwr-lbl", title: hint ?? label }, label),
      h("span", { class: "cwr-bar", title: `${r.w}/${r.d}/${r.l}` }, seg("w", r.w), seg("d", r.d), seg("l", r.l)),
      h("span", { class: "cwr-val" }, `${CWR.fmtPct(CWR.pct(r))} · ${n}`),
    );
  }

  function countRow(label, n, total) {
    const p = total ? (n / total) * 100 : 0;
    return h(
      "div",
      { class: "cwr-row" },
      h("span", { class: "cwr-lbl" }, label),
      h("span", { class: "cwr-bar" }, h("i", { class: "cwr-seg a", style: { width: `${Math.min(100, p)}%` } })),
      h("span", { class: "cwr-val" }, `${p.toFixed(0)}% · ${n}`),
    );
  }

  // Строка таблицы с тремя колонками: подпись и два значения.
  const cmpRow = (label, a, b, head = false) =>
    h("div", { class: `cwr-cmp${head ? " head" : ""}` }, h("span", {}, label), h("span", {}, a), h("span", {}, b));

  function spark(values, ref) {
    const w = 300;
    const hgt = 64;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${w} ${hgt}`);
    svg.setAttribute("class", "cwr-spark");
    if (values.length < 2) return svg;
    let min = Math.min(...values, ref ?? Infinity);
    let max = Math.max(...values, ref ?? -Infinity);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const x = (i) => (i * w) / (values.length - 1);
    const y = (v) => hgt - 4 - ((v - min) / (max - min)) * (hgt - 8);
    if (ref != null) {
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", 0);
      line.setAttribute("x2", w);
      line.setAttribute("y1", y(ref));
      line.setAttribute("y2", y(ref));
      line.setAttribute("class", "cwr-ref");
      svg.append(line);
    }
    const poly = document.createElementNS(SVG_NS, "polyline");
    poly.setAttribute("points", values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" "));
    poly.setAttribute("class", "cwr-line");
    svg.append(poly);
    return svg;
  }

  function sparkBlock(title, values, ref, minLabel, maxLabel) {
    return h(
      "div",
      { class: "cwr-block" },
      sub(title),
      spark(values, ref),
      values.length >= 2 ? h("div", { class: "cwr-range" }, h("span", {}, minLabel), h("span", {}, maxLabel)) : muted(t("no_games")),
    );
  }

  function download(filename, text, type) {
    const url = URL.createObjectURL(new Blob(["﻿", text], { type }));
    const a = h("a", { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const resolveTheme = (pref) =>
    pref === "auto" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : pref === "light" ? "light" : "dark";

  // target: { user, kind: "profile" | "game", me }
  CWR.mountPanel = function mountPanel(target, settings) {
    const st = {
      dead: false,
      tab: "overview",
      profile: null,
      stats: null,
      games: null,
      myGames: null,
      progress: null,
      error: null,
      missing: false,
      settings,
      cmp: { input: null, started: false, loading: false, error: null, user: null, stats: null, games: null },
    };
    const root = h("div", { id: "cwr-panel", "data-theme": resolveTheme(settings.theme) });
    document.body.append(root);

    const isSelf = Boolean(target.me) && target.user === target.me;
    const filtered = () => (st.games ? CWR.filterGames(st.games, st.settings) : []);
    const save = (patch) => {
      st.settings = { ...st.settings, ...patch };
      CWR.saveSettings(patch);
    };

    function pickFilter(key, options, label) {
      return h(
        "select",
        {
          "aria-label": label,
          onchange: (e) => {
            save({ [key]: e.target.value });
            draw();
          },
        },
        options.map(([value, text]) => h("option", { value, selected: st.settings[key] === value ? "" : null }, text)),
      );
    }

    // ---------- вкладки ----------

    function overview() {
      const out = [];
      if (st.stats) {
        out.push(sub(t("all_time")));
        for (const m of MODES) {
          const s = st.stats[`chess_${m}`];
          if (!s?.record) continue;
          const rating = s.last?.rating;
          const { win, draw, loss } = s.record;
          out.push(statRow(rating ? `${t(m)} ${rating}` : t(m), { w: win, d: draw, l: loss }));
        }
      }
      if (st.games) {
        const games = filtered();
        if (!games.length) {
          out.push(muted(t("no_games")));
        } else {
          const agg = CWR.aggregate(games);
          out.push(sub(t("by_color")));
          out.push(statRow(t("white"), agg.color.w), statRow(t("black"), agg.color.b));
          const tcs = CWR.byTimeControl(games);
          if (tcs.length) {
            out.push(sub(t("sec_tc")));
            for (const x of tcs) out.push(statRow(x.label, x.rec));
          }
          out.push(sub(t("form")));
          for (const n of [20, 50, 100]) if (games.length >= n) out.push(statRow(t("last_n", n), CWR.lastN(games, n)));
          out.push(muted(t("games_in_sample", games.length)));
        }
      }
      return out;
    }

    function openings() {
      const games = filtered();
      if (!games.length) return [muted(t("no_games"))];
      const agg = CWR.aggregate(games);
      const hl = CWR.openingHighlights(games);
      const out = [];
      const named = (x) => statRow(`${x.name} (${t(x.color === "w" ? "white" : "black")})`, x.rec);
      if (hl.worst.length) out.push(sub(t("sec_weak")), ...hl.worst.map(named));
      if (hl.best.length) out.push(sub(t("sec_strong")), ...hl.best.map(named));
      for (const c of ["w", "b"]) {
        out.push(sub(t(c === "w" ? "white" : "black")));
        if (!agg.openings[c].length) out.push(muted(t("few_games")));
        for (const o of agg.openings[c]) out.push(statRow(o.name, o.rec, o.name));
      }
      return out;
    }

    function endings() {
      const games = filtered();
      if (!games.length) return [muted(t("no_games"))];
      const agg = CWR.aggregate(games);
      const out = [];
      for (const [key, title] of [["w", "won_by"], ["l", "lost_by"], ["d", "drawn_by"]]) {
        const total = agg.total[key];
        if (!total) continue;
        out.push(sub(`${t(title)} (${total})`));
        for (const e of ENDINGS) if (agg.endings[key][e]) out.push(countRow(t(`end_${e}`), agg.endings[key][e], total));
      }
      return out;
    }

    function timeTab() {
      const games = filtered();
      if (!games.length) return [muted(t("no_games"))];
      const agg = CWR.aggregate(games);
      const days = t("weekdays").split(",");
      return [
        sub(t("by_hour")),
        ...agg.hours.map((r, i) => statRow(HOURS[i], r)),
        sub(t("by_weekday")),
        ...agg.days.map((r, i) => statRow(days[i], r)),
      ];
    }

    function goalBlock() {
      const goal = Number(st.settings.goal) || 0;
      if (!isSelf || goal <= 0 || !st.games?.length) return [];
      const gp = CWR.goalProgress(st.games, st.settings.mode, goal);
      if (!gp) return [];
      const out = [sub(t("sec_goal")), kv(t("goal_current"), `${gp.current} (${t(gp.cls)})`), kv(t("goal_target"), String(goal))];
      out.push(countRow(t("goal_progress"), gp.current, goal));
      if (gp.reached) {
        out.push(tip(t("goal_reached")));
        return out;
      }
      out.push(kv(t("goal_left"), String(gp.remaining)));
      if (gp.slope != null) out.push(kv(t("goal_slope"), signed(Math.round(gp.slope * 100))));
      if (gp.gamesNeeded) out.push(kv(t("goal_eta"), t("goal_eta_v", gp.gamesNeeded, gp.days ?? "—")));
      else out.push(muted(t("goal_no_growth")));
      return out;
    }

    function weekBlock() {
      if (!st.games?.length) return [];
      const modeGames = st.settings.mode === "all" ? st.games : st.games.filter((g) => g.k === st.settings.mode);
      const { cur, prev } = CWR.weekly(modeGames);
      if (!cur.n && !prev.n) return [];
      const rating = (w) => (w.delta == null ? "—" : `${signed(w.delta)} (${t(w.cls)})`);
      return [
        sub(t("sec_week")),
        cmpRow("", t("week_cur"), t("week_prev"), true),
        cmpRow(t("wk_games"), String(cur.n), String(prev.n)),
        cmpRow(t("wk_winrate"), CWR.fmtPct(cur.pct), CWR.fmtPct(prev.pct)),
        cmpRow(t("wk_time"), num(cur.timeUsed, "%"), num(prev.timeUsed, "%")),
        cmpRow(t("wk_acc"), num(cur.acc, "%"), num(prev.acc, "%")),
        cmpRow(t("wk_rating"), rating(cur), rating(prev)),
      ];
    }

    function trend() {
      const games = filtered();
      const out = [...goalBlock(), ...weekBlock()];
      if (!games.length) return [...out, muted(t("no_games"))];
      const series = CWR.ratingSeries(games, st.settings.mode);
      const rolling = CWR.rollingWinrate(games, 20);
      const lo = (v) => (v.length ? String(Math.min(...v).toFixed(0)) : "");
      const hi = (v) => (v.length ? String(Math.max(...v).toFixed(0)) : "");
      out.push(
        sparkBlock(t("rating_of", series.mode ? t(series.mode) : ""), series.values, null, lo(series.values), hi(series.values)),
        sparkBlock(t("rolling", 20), rolling, 50, `${lo(rolling)}%`, `${hi(rolling)}%`),
      );
      return out;
    }

    function insights() {
      const games = filtered();
      if (!games.length) return [muted(t("no_games"))];
      const out = [];

      const tu = CWR.timeUsage(games);
      out.push(sub(t("sec_clock")));
      if (!tu.n) {
        out.push(muted(t("clock_none")));
      } else {
        out.push(
          kv(t("clock_used"), num(tu.avg, "%")),
          kv(t("clock_used_win"), num(tu.win, "%")),
          kv(t("clock_used_loss"), num(tu.loss, "%")),
          kv(t("clock_per_move"), num(tu.perMove)),
          sub(t("clock_buckets")),
          ...tu.buckets.map((r, i) => statRow(BUCKETS[i], r)),
        );
        if (tu.n >= 10 && tu.avg < 50) out.push(tip(t("clock_tip", Math.round(tu.avg))));
      }

      out.push(sub(t("sec_bands")));
      const bands = CWR.ratingBands(games);
      for (const b of CWR.BANDS) out.push(statRow(t(`band_${b}`), bands[b]));

      const ss = CWR.sessionStats(games);
      out.push(sub(t("sec_sessions")), muted(t("sess_summary", ss.count, num(ss.avgLen), ss.longest)));
      out.push(sub(t("sess_pos")));
      for (const [label, r] of Object.entries(ss.pos)) out.push(statRow(`№ ${label}`, r));
      out.push(sub(t("sess_after")));
      out.push(statRow(t("after_win"), ss.afterWin), statRow(t("after_loss"), ss.afterLoss), statRow(t("after_two"), ss.afterTwoLosses));

      const acc = CWR.accuracy(games);
      out.push(sub(t("sec_accuracy")));
      if (!acc.n) {
        out.push(muted(t("acc_none")));
      } else {
        out.push(
          kv(t("acc_avg"), num(acc.avg, "%")),
          kv(t("acc_win"), num(acc.win, "%")),
          kv(t("acc_draw"), num(acc.draw, "%")),
          kv(t("acc_loss"), num(acc.loss, "%")),
          kv(t("acc_white"), num(acc.white, "%")),
          kv(t("acc_black"), num(acc.black, "%")),
          muted(t("acc_coverage", acc.n, acc.total)),
        );
        if (acc.series.length >= 2) {
          const lo = Math.min(...acc.series).toFixed(0);
          const hi = Math.max(...acc.series).toFixed(0);
          out.push(sparkBlock(t("acc_trend"), acc.series, null, `${lo}%`, `${hi}%`));
        }
      }
      return out;
    }

    function losses() {
      const list = CWR.recentLosses(filtered());
      if (!list.length) return [muted(t("losses_none"))];
      return [
        muted(t("loss_hint")),
        ...list.map((g) =>
          h(
            "div",
            { class: "cwr-loss" },
            h(
              "div",
              { class: "cwr-loss-main" },
              h("span", {}, `${new Date(g.t * 1000).toLocaleDateString(CWR.lang())} · ${t(g.k)} · ${t(g.c === "w" ? "white" : "black")}`),
              g.u
                ? h("a", { href: `https://www.chess.com/analysis/${g.u}?tab=review`, target: "_blank", rel: "noopener noreferrer" }, t("loss_review"))
                : null,
            ),
            h(
              "div",
              { class: "cwr-loss-sub" },
              [`${g.n} (${g.or})`, t(`end_${g.h}`), g.e, g.a != null ? `${g.a}%` : null].filter(Boolean).join(" · "),
            ),
          ),
        ),
      ];
    }

    // ---------- сравнение с другим игроком ----------

    const defaultOther = () => (target.me && target.me !== target.user ? target.me : "");

    async function runCompare(raw) {
      const name = raw.trim().toLowerCase();
      if (!CWR.api.isValidUser(name)) return;
      Object.assign(st.cmp, { started: true, loading: true, error: null, user: name, stats: null, games: null, input: name });
      draw();
      try {
        const months = Number(st.settings.months) || 6;
        const [stats, games] = await Promise.all([
          CWR.api.getStats(name),
          name === target.me && st.myGames ? st.myGames : CWR.api.loadGames(name, months),
        ]);
        if (!stats) st.cmp.error = t("no_user");
        Object.assign(st.cmp, { stats, games });
      } catch (e) {
        st.cmp.error = t("error", e.message || String(e));
      }
      st.cmp.loading = false;
      draw();
    }

    function compare() {
      const c = st.cmp;
      const input = h("input", {
        type: "text",
        placeholder: t("cmp_placeholder"),
        value: c.input ?? defaultOther(),
        autocomplete: "off",
        spellcheck: "false",
        oninput: (e) => (c.input = e.target.value),
      });
      const out = [
        h(
          "form",
          {
            class: "cwr-form",
            onsubmit: (e) => {
              e.preventDefault();
              runCompare(input.value);
            },
          },
          input,
          h("button", { type: "submit" }, t("cmp_go")),
        ),
      ];
      if (c.loading) return [...out, muted(t("cmp_loading"))];
      if (c.error) return [...out, h("div", { class: "cwr-err" }, c.error)];
      if (!c.stats) return out;

      const a = st.stats;
      const b = c.stats;
      const gamesA = filtered();
      const gamesB = CWR.filterGames(c.games ?? [], st.settings);
      const aggA = CWR.aggregate(gamesA);
      const aggB = CWR.aggregate(gamesB);
      const side = (s, m) => {
        const x = s?.[`chess_${m}`];
        if (!x?.record) return "—";
        const { win, draw, loss } = x.record;
        return `${x.last?.rating ?? "—"} · ${CWR.fmtPct(CWR.pct({ w: win, d: draw, l: loss }))}`;
      };
      out.push(cmpRow("", target.user, c.user, true), sub(t("cmp_alltime")));
      for (const m of MODES) if (a?.[`chess_${m}`] || b?.[`chess_${m}`]) out.push(cmpRow(t(m), side(a, m), side(b, m)));
      out.push(
        sub(t("cmp_total")),
        cmpRow(t("cmp_games"), String(gamesA.length), String(gamesB.length)),
        cmpRow(t("winrate"), CWR.fmtPct(CWR.pct(aggA.total)), CWR.fmtPct(CWR.pct(aggB.total))),
        cmpRow(t("white"), CWR.fmtPct(CWR.pct(aggA.color.w)), CWR.fmtPct(CWR.pct(aggB.color.w))),
        cmpRow(t("black"), CWR.fmtPct(CWR.pct(aggA.color.b)), CWR.fmtPct(CWR.pct(aggB.color.b))),
        cmpRow(t("wk_time"), num(CWR.timeUsage(gamesA).avg, "%"), num(CWR.timeUsage(gamesB).avg, "%")),
        cmpRow(t("wk_acc"), num(CWR.accuracy(gamesA).avg, "%"), num(CWR.accuracy(gamesB).avg, "%")),
      );
      return out;
    }

    function h2h() {
      const me = target.me;
      if (!me) return [muted(t("h2h_need_me"))];
      if (me === target.user) return [];
      if (!st.myGames) return [muted(t("loading_games", "…", "…"))];
      const { rec, recent } = CWR.headToHead(st.myGames, target.user);
      if (!CWR.count(rec)) return [muted(t("h2h_none"))];
      const mark = { w: "W", d: "D", l: "L" };
      return [
        statRow(`${me} vs ${target.user}`, rec),
        sub(t("h2h_last")),
        h(
          "div",
          { class: "cwr-chips" },
          recent.map((g) =>
            h("span", { class: `cwr-chip ${g.o}`, title: `${new Date(g.t * 1000).toLocaleDateString()} · ${t(g.k)} · ${g.e || ""}` }, mark[g.o]),
          ),
        ),
      ];
    }

    const RENDER = { overview, openings, endings, time: timeTab, trend, insights, losses, compare, h2h };

    // ---------- каркас ----------

    function aggregateAll(stats) {
      const sum = CWR.rec();
      for (const m of MODES) {
        const r = stats[`chess_${m}`]?.record;
        if (!r) continue;
        sum.w += r.win;
        sum.d += r.draw;
        sum.l += r.loss;
      }
      return sum;
    }

    function toggle() {
      save({ collapsed: !st.settings.collapsed });
      draw();
    }

    function title() {
      const all = st.stats ? aggregateAll(st.stats) : null;
      const prefix = target.kind === "game" ? `${t("opponent")}: ` : "";
      const exportable = st.games?.length;
      return h(
        "div",
        { class: "cwr-head" },
        h(
          "div",
          { class: "cwr-title" },
          h("b", {}, `${prefix}${st.profile?.username || target.user}`),
          all && CWR.count(all) ? h("span", { class: "cwr-pill" }, `${t("winrate")} ${CWR.fmtPct(CWR.pct(all))}`) : null,
        ),
        h(
          "div",
          { class: "cwr-actions" },
          exportable
            ? h("button", { title: t("csv_title"), onclick: () => download(`${target.user}-games.csv`, CWR.toCSV(filtered()), "text/csv;charset=utf-8") }, t("csv"))
            : null,
          exportable
            ? h(
                "button",
                {
                  title: t("json_title"),
                  onclick: () =>
                    download(
                      `${target.user}-games.json`,
                      JSON.stringify({ user: target.user, exported: new Date().toISOString(), games: filtered() }, null, 2),
                      "application/json",
                    ),
                },
                t("json"),
              )
            : null,
          h("button", { title: t(st.settings.collapsed ? "expand" : "collapse"), onclick: toggle }, st.settings.collapsed ? "▴" : "▾"),
        ),
      );
    }

    function meta() {
      if (!st.profile) return null;
      const bits = [];
      const country = st.profile.country?.split("/").pop();
      if (country) bits.push(country);
      if (st.profile.joined) bits.push(t("member_since", new Date(st.profile.joined * 1000).getFullYear()));
      return bits.length ? h("div", { class: "cwr-meta" }, bits.join(" · ")) : null;
    }

    // Серия поражений: у себя по своим партиям, в игре по партиям нижнего игрока.
    function tiltTip() {
      const mine = isSelf ? st.games : target.kind === "game" ? st.myGames : null;
      const streak = mine ? CWR.lossStreak(mine) : 0;
      return streak >= 3 ? tip(t("tilt_tip", streak)) : null;
    }

    function draw() {
      if (st.dead) return;
      const scroll = root.querySelector(".cwr-body")?.scrollTop ?? 0;
      root.replaceChildren(title());
      root.classList.toggle("cwr-collapsed", st.settings.collapsed);
      applyPos();
      if (st.settings.collapsed) return;

      if (st.missing) {
        root.append(h("div", { class: "cwr-body" }, muted(t("no_user"))));
        return;
      }

      const tabs = TABS.filter((x) => x !== "h2h" || (target.me && target.me !== target.user));
      if (!tabs.includes(st.tab)) st.tab = "overview";

      root.append(
        meta(),
        h(
          "div",
          { class: "cwr-filters" },
          pickFilter("mode", [["all", t("mode_all")], ...MODES.map((m) => [m, t(m)])], t("mode_all")),
          pickFilter(
            "period",
            ["all", "30", "90", "100"].map((p) => [p, t(`period_${p}`)]),
            t("period_all"),
          ),
        ),
        h(
          "div",
          { class: "cwr-tabs", role: "tablist" },
          tabs.map((id) =>
            h(
              "button",
              {
                role: "tab",
                class: id === st.tab ? "on" : "",
                "aria-selected": id === st.tab ? "true" : "false",
                onclick: () => {
                  st.tab = id;
                  if (id === "compare" && !st.cmp.started && defaultOther()) return runCompare(defaultOther());
                  draw();
                },
              },
              t(`tab_${id}`),
            ),
          ),
        ),
      );

      const body = h("div", { class: "cwr-body" }, tiltTip(), RENDER[st.tab]());
      if (st.progress) body.append(muted(t("loading_games", st.progress.done, st.progress.total)));
      if (st.error) body.append(h("div", { class: "cwr-err" }, t("error", st.error)));
      if (st.tab === "overview") body.append(h("div", { class: "cwr-hint" }, t("wld_hint")));
      root.append(body);
      body.scrollTop = scroll;
    }

    // ---------- перетаскивание за заголовок ----------

    function applyPos() {
      const p = st.settings.panelPos;
      if (!p) {
        Object.assign(root.style, { left: "", top: "", right: "", bottom: "" });
        return;
      }
      const left = Math.min(Math.max(0, p.left), Math.max(0, innerWidth - root.offsetWidth));
      const top = Math.min(Math.max(0, p.top), Math.max(0, innerHeight - root.offsetHeight));
      Object.assign(root.style, { left: `${left}px`, top: `${top}px`, right: "auto", bottom: "auto" });
    }

    root.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !e.target.closest(".cwr-head") || e.target.closest("button")) return;
      const rect = root.getBoundingClientRect();
      const start = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top };
      let moved = false;
      const move = (ev) => {
        moved = true;
        st.settings = { ...st.settings, panelPos: { left: start.left + ev.clientX - start.x, top: start.top + ev.clientY - start.y } };
        applyPos();
      };
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        if (moved) CWR.saveSettings({ panelPos: st.settings.panelPos });
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      e.preventDefault();
    });

    root.addEventListener("dblclick", (e) => {
      if (!e.target.closest(".cwr-head") || e.target.closest("button")) return;
      save({ panelPos: null });
      applyPos();
    });

    const onResize = () => applyPos();
    addEventListener("resize", onResize);

    // ---------- загрузка ----------

    async function load() {
      draw();
      try {
        [st.profile, st.stats] = await Promise.all([CWR.api.getProfile(target.user), CWR.api.getStats(target.user)]);
        if (!st.profile && !st.stats) {
          st.missing = true;
          root.hidden = target.kind === "game"; // бот или гость: в партии просто не показываем панель
          return draw();
        }
        draw();

        const months = Number(st.settings.months) || 6;
        st.games = await CWR.api.loadGames(target.user, months, (done, total) => {
          st.progress = done < total ? { done, total } : null;
          draw();
        });
        st.progress = null;
        draw();

        if (target.me && target.me !== target.user) {
          st.myGames = await CWR.api.loadGames(target.me, months);
          draw();
        }
      } catch (e) {
        st.progress = null;
        st.error = e.message || String(e);
        draw();
      }
    }

    load();

    return {
      toggle,
      destroy() {
        st.dead = true;
        removeEventListener("resize", onResize);
        root.remove();
      },
    };
  };
})();
