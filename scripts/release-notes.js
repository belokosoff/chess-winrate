// node scripts/release-notes.js 1.1.0 — печатает раздел версии из CHANGELOG.md (для описания релиза на GitHub).
const fs = require("node:fs");
const path = require("node:path");

const version = process.argv[2];
if (!version) {
  console.error("usage: node scripts/release-notes.js <version>");
  process.exit(1);
}
const text = fs.readFileSync(path.join(__dirname, "..", "CHANGELOG.md"), "utf8");
const lines = text.split("\n");
const start = lines.findIndex((l) => l.startsWith(`## [${version}]`));
if (start === -1) {
  console.error(`No section for ${version} in CHANGELOG.md`);
  process.exit(1);
}
let end = lines.findIndex((l, i) => i > start && l.startsWith("## ["));
if (end === -1) end = lines.length;
console.log(lines.slice(start + 1, end).join("\n").trim());
