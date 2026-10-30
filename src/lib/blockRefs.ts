/**
 * Bloques sincronizados con la sintaxis de Obsidian: un bloque (párrafo o
 * elemento de lista) lleva al final un identificador `^abc123`, y se
 * incrusta en otras notas con `![[Nota#^abc123]]`. Al editarlo desde
 * cualquier sitio se cambia en la nota original.
 */

const ID = /\s\^([A-Za-z0-9-]+)\s*$/;
const LIST = /^\s*(?:[-*+]|\d+[.)])\s/;
const BREAK = /^\s*(?:#{1,6}\s|```|~~~|>|\||---\s*$|\*\*\*\s*$)/;

/** Destino de una incrustación: nota y, si hay, bloque (`^id`) o sección. */
export function splitTarget(target: string) {
  const i = target.indexOf("#");
  if (i < 0) return { note: target, block: null, section: null };
  const rest = target.slice(i + 1).split("|")[0].trim();
  return rest.startsWith("^")
    ? { note: target.slice(0, i), block: rest.slice(1), section: null }
    : { note: target.slice(0, i), block: null, section: rest || null };
}

/** Líneas (desde, hasta incluida) del bloque con ese identificador. */
export function findBlock(content: string, id: string): { start: number; end: number } | null {
  const lines = content.split("\n");
  const end = lines.findIndex((l) => ID.exec(l)?.[1] === id);
  if (end < 0) return null;
  if (LIST.test(lines[end])) return { start: end, end };
  let start = end;
  while (start > 0 && lines[start - 1].trim() !== "" && !LIST.test(lines[start - 1]) && !BREAK.test(lines[start - 1])) start--;
  return { start, end };
}

/** Texto del bloque, sin su identificador. */
export function blockText(content: string, id: string): string | null {
  const b = findBlock(content, id);
  if (!b) return null;
  return content
    .split("\n")
    .slice(b.start, b.end + 1)
    .join("\n")
    .replace(ID, "");
}

/** Cambia el texto del bloque en la nota (manteniendo su identificador). */
export function replaceBlock(content: string, id: string, text: string): string | null {
  const b = findBlock(content, id);
  if (!b) return null;
  const lines = content.split("\n");
  const cr = lines[b.end].endsWith("\r") ? "\r" : "";
  const next = `${text.replace(/\s+$/, "")} ^${id}${cr}`.split("\n");
  lines.splice(b.start, b.end - b.start + 1, ...next);
  return lines.join("\n");
}

/** Sección de una nota: desde el título hasta el siguiente del mismo nivel o más. */
export function sectionText(content: string, heading: string): string | null {
  const lines = content.split("\n");
  const want = heading.trim().toLowerCase();
  const start = lines.findIndex((l) => /^#{1,6}\s/.test(l) && l.replace(/^#+\s+/, "").trim().toLowerCase() === want);
  if (start < 0) return null;
  const level = /^#+/.exec(lines[start])![0].length;
  let end = start + 1;
  while (end < lines.length && !(/^#{1,6}\s/.test(lines[end]) && /^#+/.exec(lines[end])![0].length <= level)) end++;
  return lines.slice(start, end).join("\n");
}

/** Bloques que se pueden incrustar de una nota, con su línea. */
export function listBlocks(content: string): { line: number; text: string; id: string | null }[] {
  const lines = content.split("\n");
  const out: { line: number; text: string; id: string | null }[] = [];
  let fence = false;
  let front = lines[0]?.trim() === "---";
  lines.forEach((l, i) => {
    if (front) {
      if (i > 0 && l.trim() === "---") front = false;
      return;
    }
    if (/^\s*(```|~~~)/.test(l)) fence = !fence;
    if (fence || !l.trim() || /^\s*(#{1,6}\s|```|~~~|---|!\[\[)/.test(l)) return;
    // Un párrafo de varias líneas se ofrece por su última línea.
    const next = lines[i + 1];
    if (!LIST.test(l) && next !== undefined && next.trim() !== "" && !LIST.test(next) && !BREAK.test(next)) return;
    const id = ID.exec(l)?.[1] ?? null;
    out.push({ line: i, id, text: l.replace(ID, "").replace(LIST, "").replace(/^\[[ xX]\]\s*/, "").trim() });
  });
  return out;
}

/** Identificador nuevo corto (como los de Obsidian). */
export function newBlockId() {
  return Math.random().toString(36).slice(2, 8);
}

/** Añade `^id` al final de la línea (si aún no tiene) y devuelve el contenido y el id. */
export function ensureBlockId(content: string, line: number): { content: string; id: string } {
  const lines = content.split("\n");
  const existing = ID.exec(lines[line])?.[1];
  if (existing) return { content, id: existing };
  const id = newBlockId();
  const cr = lines[line].endsWith("\r") ? "\r" : "";
  lines[line] = `${lines[line].replace(/\s*\r?$/, "")} ^${id}${cr}`;
  return { content: lines.join("\n"), id };
}
