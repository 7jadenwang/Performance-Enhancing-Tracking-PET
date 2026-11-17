import fs from "node:fs";
const p = JSON.parse(fs.readFileSync("src/program/catalog.json", "utf8")),
  m = JSON.parse(fs.readFileSync("src/program/source-manifest.json", "utf8"));
for (const path of p.sources) {
  if (
    !fs.existsSync("public/" + path) ||
    m.entries.filter((e) => e.path === path).length !== 1 ||
    p.sessions.filter((s) => s.sources.includes(path)).length !== 1
  )
    throw Error("Invalid source mapping: " + path);
}
if (new Set(p.sources).size !== 119 || !m.entries.every((e) => e.review))
  throw Error("Incomplete inventory");
if (p.sessions.length !== 95 || p.sessions.filter(s=>s.programId === "up").length !== 38) throw Error("Incorrect track inventory");
console.log(
  `${p.sources.length} source images, ${p.sessions.length} sessions; source mappings complete. OCR ambiguities remain labelled.`,
);
