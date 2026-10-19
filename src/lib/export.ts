import { invoke } from "@tauri-apps/api/core";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { CALLOUT_TYPES } from "./callout";
import { splitFrontmatter } from "./frontmatter";

/** Estilos del HTML exportado: legible, sin depender de la app. */
const STYLE = `
body { max-width: 760px; margin: 3rem auto; padding: 0 1.25rem; font: 16px/1.65 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2328; }
h1, h2, h3 { line-height: 1.25; } h1 { font-size: 2.1em; }
img, svg { max-width: 100%; height: auto; border-radius: 6px; }
pre { background: #f6f8fa; padding: 0.9rem 1rem; border-radius: 6px; overflow-x: auto; }
code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.9em; }
blockquote { margin: 0; padding-left: 1rem; border-left: 3px solid #d0d7de; color: #57606a; }
table { border-collapse: collapse; } th, td { border: 1px solid #d0d7de; padding: 0.35rem 0.6rem; }
mark { background: #fef08a; padding: 0 2px; }
.wikilink { color: #6d28d9; }
.props { font-size: 0.9em; color: #57606a; margin-bottom: 1.5rem; } .props td { border: 0; padding: 0.1rem 1rem 0.1rem 0; }
.callout { border-left: 3px solid #3b82f6; background: #3b82f614; border-radius: 6px; padding: 0.5rem 0.9rem; margin: 1rem 0; }
.callout.tip { border-color: #16a34a; background: #16a34a14; } .callout.warning { border-color: #d97706; background: #d9770614; } .callout.danger { border-color: #dc2626; background: #dc262614; }
.callout-title { font-weight: 600; }
`;

const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * HTML completo de una nota, en un único fichero: imágenes y diagramas
 * van dentro, para que se vea igual en cualquier navegador.
 */
export async function noteToHtml(
  title: string,
  content: string,
  props: Record<string, unknown>,
  imageUrl: (src: string) => string,
): Promise<string> {
  const { body } = splitFrontmatter(content);
  const prepared = body
    .replace(/^!\[\[([^\]]+)\]\]$/gm, (_, t) => `<p class="wikilink">↳ ${escape(t)}</p>`)
    .replace(
      /\[\[([^\]|#]*)(?:#([^\]|]*))?(?:\|([^\]]+))?\]\]/g,
      (_, t, sec, alias) => `<span class="wikilink">${escape(alias ?? (t || sec || ""))}</span>`,
    )
    .replace(/==([^=\n]+)==/g, "<mark>$1</mark>");
  const doc = new DOMParser().parseFromString(
    DOMPurify.sanitize(marked.parse(prepared, { async: false }) as string),
    "text/html",
  );

  // Avisos > [!tipo] Título
  for (const quote of Array.from(doc.querySelectorAll("blockquote"))) {
    const first = quote.querySelector("p");
    const m = first?.innerHTML.match(/^\[!([\w-]+)\][+-]?\s*([^\n<]*)/);
    if (!first || !m) continue;
    const type = m[1].toLowerCase();
    const label = CALLOUT_TYPES[type as keyof typeof CALLOUT_TYPES]?.label ?? type;
    first.innerHTML = first.innerHTML.slice(m[0].length).replace(/^\s*<br>\s*/, "");
    if (!first.textContent?.trim()) first.remove();
    const box = doc.createElement("div");
    box.className = `callout ${type}`;
    box.innerHTML = `<div class="callout-title">${escape(m[2] || label)}</div>${quote.innerHTML}`;
    quote.replaceWith(box);
  }

  // Imágenes dentro del fichero.
  for (const img of Array.from(doc.querySelectorAll("img"))) {
    const data = await toDataUrl(imageUrl(img.getAttribute("src") ?? ""));
    if (data) img.src = data;
  }

  // Diagramas Mermaid dibujados como SVG.
  const diagrams = Array.from(doc.querySelectorAll("pre > code.language-mermaid"));
  if (diagrams.length) {
    const { default: mermaid } = await import("mermaid");
    mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "strict" });
    for (const [i, code] of diagrams.entries()) {
      try {
        const { svg } = await mermaid.render(`export-mermaid-${i}`, code.textContent ?? "");
        const holder = doc.createElement("div");
        holder.innerHTML = svg;
        code.parentElement!.replaceWith(holder);
      } catch {
        // Si no se puede dibujar, se deja el código.
      }
    }
  }

  const entries = Object.entries(props);
  const propsTable = entries.length
    ? `<table class="props">${entries
        .map(
          ([k, v]) =>
            `<tr><td>${escape(k)}</td><td>${escape(Array.isArray(v) ? v.join(", ") : String(v ?? ""))}</td></tr>`,
        )
        .join("")}</table>`
    : "";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>${STYLE}</style>
</head>
<body>
${propsTable}
${doc.body.innerHTML}
</body>
</html>
`;
}

/** Guarda el HTML donde elija la persona. Devuelve la ruta o `null`. */
export function saveHtml(name: string, html: string): Promise<string | null> {
  return invoke<string | null>("export_html", { name, html });
}

/** Diálogo de imprimir (permite «Guardar como PDF»). */
export async function printNote() {
  try {
    await invoke("print_page");
  } catch {
    window.print();
  }
}
