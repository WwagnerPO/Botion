import type { Node as ProseNode } from "@milkdown/kit/prose/model";

/** Títulos y recuento de palabras de una nota, para el índice lateral. */
export interface DocStats {
  headings: { level: number; text: string }[];
  words: number;
  characters: number;
}

/** Palabras de un texto (también con guion o apóstrofo: «bien-estar», «l'àvia»). */
export function countWords(text: string) {
  return (text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
}

export function docStats(doc: ProseNode): DocStats {
  const headings: DocStats["headings"] = [];
  let text = "";
  doc.descendants((node) => {
    if (node.type.name === "heading") {
      const t = node.textContent.trim();
      if (t) headings.push({ level: node.attrs.level, text: t });
    }
    if (node.isTextblock) {
      text += node.textContent + "\n";
      return false;
    }
    return true;
  });
  return { headings, words: countWords(text), characters: text.replace(/\n/g, "").length };
}

/** «1 min de lectura» (unas 220 palabras por minuto). */
export function readingTime(words: number) {
  return `${Math.max(1, Math.round(words / 220))} min de lectura`;
}
