import { invoke } from "@tauri-apps/api/core";
import TurndownService from "turndown";
import { today } from "./slashCommands";

/** Carpeta donde se guardan las páginas recortadas. */
export const CLIPS_FOLDER = "Recortes";

const NOISE = [
  "script, style, noscript, iframe, form, nav, header, footer, aside, svg, button, select, input, template",
  "dialog, details-menu, [hidden], [aria-hidden=true]",
  "[role=navigation], [role=dialog], [role=menu], [role=tooltip], [role=alert]",
  ".ad, .ads, .cookie, .newsletter, .sr-only, .visually-hidden",
].join(", ");

/** Contenedores habituales del texto principal, de más a menos concreto. */
const CONTENT = [
  "[itemprop=articleBody]",
  ".markdown-body",
  ".entry-content",
  ".post-content",
  ".article-body",
  "article",
  "main",
  "[role=main]",
];

/** Nombre de nota válido a partir del título de la página. */
export function noteName(title: string) {
  const clean = title
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  return (clean || "Página sin título").slice(0, 90).trim();
}

/** Parte principal de la página: el artículo, o el bloque con más párrafos. */
function mainContent(doc: Document): Element {
  for (const selector of CONTENT) {
    const direct = doc.querySelector(selector);
    if (direct && direct.textContent!.trim().length > 200) return direct;
  }
  let best: Element = doc.body;
  let score = 0;
  doc.querySelectorAll("div, section").forEach((el) => {
    const s = [...el.children].filter((c) => c.tagName === "P").reduce((n, p) => n + p.textContent!.length, 0);
    if (s > score) {
      score = s;
      best = el;
    }
  });
  return best;
}

/** Título, Markdown y descripción de una página HTML. */
export function htmlToNote(html: string, url: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const base = doc.createElement("base");
  base.href = url;
  doc.head.prepend(base);
  const meta = (name: string) =>
    doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute("content")?.trim() ?? "";
  const title = meta("og:title") || doc.title.trim() || new URL(url).hostname;
  const root = mainContent(doc);
  root.querySelectorAll(NOISE).forEach((el) => el.remove());
  // Enlaces e imágenes con la dirección completa, para que sigan funcionando.
  root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => (a.href = new URL(a.getAttribute("href")!, url).href));
  root.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    const src = img.getAttribute("data-src") || img.getAttribute("src");
    if (src) img.setAttribute("src", new URL(src, url).href);
    else img.remove();
  });
  const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-", hr: "---" });
  let markdown = turndown
    .turndown(root.innerHTML)
    // Turndown deja «-   texto»: un solo espacio tras la viñeta, como se escribe a mano.
    .replace(/^(\s*)(-|\d+\.) {2,}/gm, "$1$2 ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  // El título va como encabezado (si la página no lo repite ya).
  if (!markdown.startsWith("# ")) markdown = `# ${title}\n\n${markdown}`;
  return { title, description: meta("og:description") || meta("description"), markdown };
}

/** Descarga la página y la convierte en el contenido de una nota. */
export async function clipPage(url: string) {
  const page = await invoke<{ url: string; html: string }>("fetch_page", { url });
  const { title, description, markdown } = htmlToNote(page.html, page.url);
  const front = [
    "---",
    `fuente: ${JSON.stringify(page.url)}`,
    `recortado: ${today()}`,
    ...(description ? [`descripción: ${JSON.stringify(description.slice(0, 300))}`] : []),
    "---",
    "",
  ].join("\n");
  return { title, name: noteName(title), content: `${front}${markdown}\n` };
}
