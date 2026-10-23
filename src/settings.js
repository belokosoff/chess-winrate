(() => {
  const DEFAULTS = {
    lang: "auto",
    panel: true,
    badges: true,
    collapsed: false,
    period: "all", // all | 30 | 90 | 100
    mode: "all", // all | rapid | blitz | bullet | daily
    months: 6,
    me: "",
    goal: 0, // целевой рейтинг, 0 — выключено
    theme: "dark", // dark | light | auto
    panelPos: null, // { left, top } после перетаскивания
  };

  CWR.DEFAULTS = DEFAULTS;

  CWR.loadSettings = async () => {
    const stored = (await CWR.ext.storage.local.get("settings")).settings;
    return { ...DEFAULTS, ...(stored || {}) };
  };

  CWR.saveSettings = async (patch) => {
    const next = { ...(await CWR.loadSettings()), ...patch };
    await CWR.ext.storage.local.set({ settings: next });
    return next;
  };

  CWR.onSettingsChanged = (cb) => {
    CWR.ext.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.settings) cb({ ...DEFAULTS, ...changes.settings.newValue });
    });
  };
})();
