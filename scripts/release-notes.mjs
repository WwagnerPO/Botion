// Saca de CHANGELOG.md las novedades de la versión de package.json
// (sección «## vX.Y.Z» hasta la siguiente «## v») para la página de la versión.
import { readFileSync } from "node:fs";

const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const lines = readFileSync("CHANGELOG.md", "utf8").split("\n");
const start = lines.findIndex((l) => l.trim() === `## v${version}`);
if (start < 0) {
  console.error(`CHANGELOG.md no tiene la sección «## v${version}».`);
  process.exit(1);
}
let end = lines.findIndex((l, i) => i > start && l.startsWith("## v"));
if (end < 0) end = lines.length;
process.stdout.write(lines.slice(start + 1, end).join("\n").trim() + "\n");
