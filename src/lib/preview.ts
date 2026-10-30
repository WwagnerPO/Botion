import DOMPurify from "dompurify";
import { marked } from "marked";

/** Markdown de una nota → HTML seguro, con los extras de Botion básicos. */
export function toHtml(markdown: string) {
  const prepared = markdown
    .replace(/%%[\s\S]*?%%/g, "")
    .replace(/!\[\[([^\]]+)\]\]/g, "↳ $1")
    .replace(/\[\[([^\]|#]*)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, t, alias) => `**${alias ?? t}**`)
    .replace(/==([^=\n]+)==/g, "<mark>$1</mark>")
    .replace(/^> \[!(\w+)\][+-]? ?(.*)$/gm, (_, type, title) => `> **${title || type}**`);
  return DOMPurify.sanitize(marked.parse(prepared, { async: false }) as string);
}
