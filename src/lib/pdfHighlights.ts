/**
 * Subrayados de un PDF. Se guardan en una nota junto al PDF
 * («informe (subrayados).md»), una línea por subrayado:
 *
 *   - p. 3 · «texto subrayado» %%0.1,0.2,0.3,0.02%% ^h1a2b3
 *
 * Lo de dentro de `%%…%%` (dónde está en la página) no se ve en Obsidian, y
 * el `^id` permite incrustar el subrayado en otra nota (`![[…#^h1a2b3]]`).
 */

export type Rect = [number, number, number, number];

export interface Highlight {
  id: string;
  page: number;
  text: string;
  /** Rectángulos en fracciones de la página (x, y, ancho, alto). */
  rects: Rect[];
}

const LINE = /^- p\. (\d+) · «(.*)» %%([\d.,;\s-]*)%% \^([A-Za-z0-9-]+)\s*$/;

/** Nota de subrayados de un PDF (en la misma carpeta). */
export function sidecarPath(pdfPath: string) {
  return `${pdfPath.replace(/\.pdf$/i, "")} (subrayados).md`;
}

export function parseHighlights(markdown: string): Highlight[] {
  const out: Highlight[] = [];
  for (const line of markdown.split("\n")) {
    const m = LINE.exec(line.replace(/\r$/, ""));
    if (!m) continue;
    const rects = m[3]
      .split(";")
      .map((r) => r.split(",").map(Number))
      .filter((r): r is Rect => r.length === 4 && r.every(Number.isFinite));
    out.push({ id: m[4], page: Number(m[1]), text: m[2], rects });
  }
  return out;
}

const round = (n: number) => Math.round(n * 10000) / 10000;

function line(h: Highlight) {
  const text = h.text.replace(/\s+/g, " ").replace(/»/g, '"').trim();
  const rects = h.rects.map((r) => r.map(round).join(",")).join(";");
  return `- p. ${h.page} · «${text}» %%${rects}%% ^${h.id}`;
}

/**
 * Contenido de la nota de subrayados: se conserva lo que haya escrito la
 * persona y la lista de subrayados va al final, ordenada por página.
 */
export function highlightsMarkdown(existing: string | null, pdfPath: string, list: Highlight[]) {
  const name = pdfPath.split("/").pop()!;
  const keep = (existing ?? `# Subrayados de ${name}\n\nPDF: [[${pdfPath}]]\n`)
    .split("\n")
    .filter((l) => !LINE.test(l.replace(/\r$/, "")))
    .join("\n")
    .replace(/\s+$/, "");
  const sorted = [...list].sort((a, b) => a.page - b.page || (a.rects[0]?.[1] ?? 0) - (b.rects[0]?.[1] ?? 0));
  return `${keep}\n\n${sorted.map(line).join("\n")}${sorted.length ? "\n" : ""}`;
}
