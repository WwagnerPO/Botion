import { $nodeSchema, $remark } from "@milkdown/kit/utils";

/**
 * Comentarios con la sintaxis de Obsidian: `%%texto%%` no se ve al leer la
 * nota allí. En Botion son un 💬 dentro del texto y una tarjeta al margen.
 */

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
}

const COMMENT = /%%((?:(?!%%)[\s\S])+?)%%/g;

function split(node: MdNode): MdNode[] {
  const text = node.value ?? "";
  const out: MdNode[] = [];
  let last = 0;
  for (const m of text.matchAll(COMMENT)) {
    if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
    out.push({ type: "comment", value: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (out.length === 0) return [node];
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

function transform(node: MdNode) {
  if (!node.children) return;
  node.children = node.children.flatMap((child) => {
    if (child.type === "text") return split(child);
    transform(child);
    return [child];
  });
}

function remarkComments(this: { data: () => Record<string, unknown[] | undefined> }) {
  const data = this.data();
  (data.toMarkdownExtensions ??= []).push({
    handlers: { comment: (node: MdNode) => `%%${(node.value ?? "").replace(/%%/g, "%")}%%` },
  });
  return (tree: MdNode) => transform(tree);
}

export const commentRemark = $remark("comments", () => remarkComments as never);

export const commentSchema = $nodeSchema("comment", () => ({
  group: "inline",
  inline: true,
  atom: true,
  attrs: { text: { default: "" } },
  parseDOM: [{ tag: "span.note-comment", getAttrs: (dom) => ({ text: (dom as HTMLElement).dataset.comment ?? "" }) }],
  toDOM: (node) => ["span", { class: "note-comment", "data-comment": node.attrs.text, title: node.attrs.text }, "💬"],
  parseMarkdown: {
    match: (node) => node.type === "comment",
    runner: (state, node, type) => {
      state.addNode(type, { text: (node.value as string) ?? "" });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "comment",
    runner: (state, node) => {
      state.addNode("comment", undefined, node.attrs.text);
    },
  },
}));

export const comments = [commentRemark, commentSchema].flat();
