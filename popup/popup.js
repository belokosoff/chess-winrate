(async () => {
  const $ = (id) => document.getElementById(id);
  const MONTHS = [1, 3, 6, 12, 24];

  let settings = await CWR.loadSettings();

  function translate() {
    CWR.setLang(settings.lang);
    document.documentElement.lang = CWR.lang();
    for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = CWR.t(el.dataset.i18n);
    const months = $("months");
    months.replaceChildren(
      ...MONTHS.map((n) => {
        const o = document.createElement("option");
        o.value = n;
        o.textContent = CWR.t("s_months_n", n);
        o.selected = Number(settings.months) === n;
        return o;
      }),
    );
  }

  function fill() {
    $("lang").value = settings.lang;
    $("panel").checked = settings.panel;
    $("badges").checked = settings.badges;
    $("period").value = settings.period;
    $("mode").value = settings.mode;
    $("me").value = settings.me;
    $("goal").value = settings.goal || "";
    $("theme").value = settings.theme;
  }

  async function save(patch) {
    settings = await CWR.saveSettings(patch);
  }

  translate();
  fill();

  $("lang").addEventListener("change", async (e) => {
    await save({ lang: e.target.value });
    translate();
    fill();
  });
  $("panel").addEventListener("change", (e) => save({ panel: e.target.checked }));
  $("badges").addEventListener("change", (e) => save({ badges: e.target.checked }));
  $("period").addEventListener("change", (e) => save({ period: e.target.value }));
  $("mode").addEventListener("change", (e) => save({ mode: e.target.value }));
  $("months").addEventListener("change", (e) => save({ months: Number(e.target.value) }));
  $("me").addEventListener("change", (e) => save({ me: e.target.value.trim().toLowerCase() }));

  $("goal").addEventListener("change", (e) => save({ goal: Math.max(0, Math.min(4000, Math.round(Number(e.target.value) || 0))) }));
  $("theme").addEventListener("change", (e) => save({ theme: e.target.value }));

  $("clear").addEventListener("click", async () => {
    await CWR.api.clearCache();
    $("status").textContent = CWR.t("s_cleared");
    setTimeout(() => ($("status").textContent = ""), 2000);
  });
})();
