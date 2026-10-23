// node scripts/build.js — собирает dist/winrate-stats-{chrome,firefox}-<версия>.zip
// Chrome не знает ключ browser_specific_settings, поэтому в его пакете манифест без него.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const INCLUDE = ["content.css", "icons", "popup", "src"];

fs.rmSync(dist, { recursive: true, force: true });

for (const target of ["chrome", "firefox"]) {
  const stage = path.join(dist, target);
  fs.mkdirSync(stage, { recursive: true });
  for (const item of INCLUDE) fs.cpSync(path.join(root, item), path.join(stage, item), { recursive: true });

  const m = structuredClone(manifest);
  if (target === "chrome") delete m.browser_specific_settings;
  fs.writeFileSync(path.join(stage, "manifest.json"), `${JSON.stringify(m, null, 2)}\n`);

  const out = path.join(dist, `winrate-stats-${target}-${manifest.version}.zip`);
  execFileSync("zip", ["-r", "-X", out, "."], { cwd: stage, stdio: "ignore" });
  console.log(`${path.relative(root, out)}  (${fs.statSync(out).size} bytes)`);
}
