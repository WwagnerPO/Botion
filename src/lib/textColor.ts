import type { EditorView } from "@milkdown/kit/prose/view";
import { $markSchema, $remark } from "@milkdown/kit/utils";
import { colorName } from "./colors";

/**
 * Color de texto y de fondo con HTML, que también entiende Obsidian:
 * `<span style="color: #d44c47; background-color: #fbf3db">texto</span>`.
 */

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  color?: string | null;
  background?: string | null;
}

const OPEN = /^<span\s+style\s*=\s*(?:"([^"]*)"|'([^']*)')\s*>$/i;
const ANY_OPEN = /^<span\b[^>]*>$/i;
const CLOSE = /^<\/span\s*>$/i;

/** `color` y `background-color` de un atributo style. */
export function parseStyle(style: string) {
  let color: string | null = null;
  let background: string | null = null;
  for (const part of style.split(";")) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const key = part.slice(0, i).trim().toLowerCase();
    const value = part.slice(i + 1).trim();
    if (key === "color") color = value;
    else if (key === "background-color" || key === "background") background = value;
  }
  return color || background ? { color, background } : null;
}

/** Junta `<span style=…>`, su contenido y `</span>` en un nodo `textColor`. */
function wrap(children: MdNode[]): MdNode[] {
  const out: MdNode[] = [];
  for (let i = 0; i < children.length; i++) {
    const n = children[i];
    const open = n.type === "html" ? OPEN.exec(n.value ?? "") : null;
    const style = open ? parseStyle(open[1] ?? open[2] ?? "") : null;
    if (style) {
      let depth = 0;
      let j = i + 1;
      for (; j < children.length; j++) {
        const c = children[j];
        if (c.type !== "html") continue;
        if (ANY_OPEN.test(c.value ?? "")) depth++;
        else if (CLOSE.test(c.value ?? "") && depth-- === 0) break;
      }
      if (j < children.length) {
        out.push({ type: "textColor", ...style, children: wrap(children.slice(i + 1, j)) });
        i = j;
        continue;
      }
    }
    if (n.children) n.children = wrap(n.children);
    out.push(n);
  }
  return out;
}

type PhrasingState = {
  containerPhrasing: (node: MdNode, info: Record<string, unknown>) => string;
};

function remarkTextColor(this: { data: () => Record<string, unknown[] | undefined> }) {
  const data = this.data();
  (data.toMarkdownExtensions ??= []).push({
    handlers: {
      textColor: (node: MdNode, _parent: unknown, state: PhrasingState, info: Record<string, unknown>) => {
        const style = [node.color && `color: ${node.color}`, node.background && `background-color: ${node.background}`]
          .filter(Boolean)
          .join("; ");
        return `<span style="${style}">${state.containerPhrasing(node, { ...info, before: ">", after: "<" })}</span>`;
      },
    },
  });
  return (tree: MdNode) => {
    if (tree.children) tree.children = wrap(tree.children);
  };
}

export const textColorRemark = $remark("textColor", () => remarkTextColor as never);

export const textColorSchema = $markSchema("text_color", () => ({
  attrs: { color: { default: null }, background: { default: null } },
  parseDOM: [
    {
      tag: "span[data-text-color]",
      getAttrs: (dom) => ({
        color: (dom as HTMLElement).dataset.textColor || null,
        background: (dom as HTMLElement).dataset.textBg || null,
      }),
    },
  ],
  toDOM: (mark) => {
    const { color, background } = mark.attrs as { color: string | null; background: string | null };
    const c = color ? colorName(color, "text") : null;
    const b = background ? colorName(background, "bg") : null;
    // Los colores de la paleta cambian en modo oscuro; los demás se ven tal cual.
    const style = [!c && color ? `color: ${color}` : "", !b && background ? `background-color: ${background}` : ""]
      .filter(Boolean)
      .join("; ");
    return [
      "span",
      {
        class: "text-color",
        "data-text-color": color ?? "",
        "data-text-bg": background ?? "",
        "data-color": c ?? undefined,
        "data-bg": b ?? undefined,
        style: style || undefined,
      },
      0,
    ];
  },
  parseMarkdown: {
    match: (node) => node.type === "textColor",
    runner: (state, node, markType) => {
      state.openMark(markType, { color: node.color ?? null, background: node.background ?? null });
      state.next(node.children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === "text_color",
    runner: (state, mark) => {
      state.withMark(mark, "textColor", undefined, { color: mark.attrs.color, background: mark.attrs.background });
    },
  },
}));

/** Cambia el color de texto o de fondo (`null` lo quita) entre `from` y `to`. */
export function setTextColor(
  view: EditorView,
  from: number,
  to: number,
  patch: { color?: string | null; background?: string | null },
) {
  const type = view.state.schema.marks.text_color;
  const tr = view.state.tr;
  view.state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return true;
    const start = Math.max(pos, from);
    const end = Math.min(pos + node.nodeSize, to);
    const current = type.isInSet(node.marks);
    const attrs = {
      color: current?.attrs.color ?? null,
      background: current?.attrs.background ?? null,
      ...patch,
    };
    tr.removeMark(start, end, type);
    if (attrs.color || attrs.background) tr.addMark(start, end, type.create(attrs));
    return false;
  });
  view.dispatch(tr);
  view.focus();
}

export const textColor = [textColorRemark, textColorSchema].flat();
