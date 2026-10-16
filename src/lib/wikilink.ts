import { InputRule } from "@milkdown/kit/prose/inputrules";
import { $inputRule, $nodeSchema, $remark } from "@milkdown/kit/utils";

/**
 * Enlaces `[[nota]]`, `[[nota|texto]]` y `[[nota#sección]]` en el editor.
 * En el documento son un nodo propio, así que al guardar se escriben tal
 * cual, sin que Milkdown escape los corchetes.
 */

const LINK = /\[\[([^[\]|\n]+?)(?:\|([^[\]\n]+?))?\]\]/g;

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  target?: string;
  alias?: string | null;
}

/** Convierte los `[[...]]` de los nodos de texto en nodos `wikiLink`. */
function splitText(node: MdNode): MdNode[] {
  const text = node.value ?? "";
  const out: MdNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
    out.push({ type: "wikiLink", target: m[1].trim(), alias: m[2]?.trim() || null });
    last = m.index + m[0].length;
  }
  if (out.length === 0) return [node];
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

function transform(node: MdNode) {
  if (!node.children) return;
  node.children = node.children.flatMap((child) => {
    if (child.type === "text") return splitText(child);
    transform(child);
    return [child];
  });
}

/** Plugin de remark: lee `[[...]]` al cargar y lo escribe tal cual al guardar. */
function remarkWikiLink(this: {
  data: () => Record<string, unknown[] | undefined>;
}) {
  const data = this.data();
  (data.toMarkdownExtensions ??= []).push({
    handlers: {
      wikiLink: (node: MdNode) =>
        `[[${node.target}${node.alias ? `|${node.alias}` : ""}]]`,
    },
  });
  return (tree: MdNode) => transform(tree);
}

// Los tipos de unified no encajan con un plugin escrito a mano.
export const wikiLinkRemark = $remark("wikiLink", () => remarkWikiLink as never);

export const wikiLinkSchema = $nodeSchema("wikilink", () => ({
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  attrs: {
    target: { default: "" },
    alias: { default: null },
  },
  parseDOM: [
    {
      tag: "span[data-wikilink]",
      getAttrs: (dom) => ({
        target: (dom as HTMLElement).dataset.wikilink ?? "",
        alias: (dom as HTMLElement).dataset.alias ?? null,
      }),
    },
  ],
  toDOM: (node) => [
    "span",
    {
      class: "wikilink",
      "data-wikilink": node.attrs.target,
      ...(node.attrs.alias ? { "data-alias": node.attrs.alias } : {}),
      title: node.attrs.target,
    },
    node.attrs.alias || node.attrs.target,
  ],
  parseMarkdown: {
    match: (node) => node.type === "wikiLink",
    runner: (state, node, type) => {
      state.addNode(type, {
        target: node.target as string,
        alias: (node.alias as string | null) ?? null,
      });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "wikilink",
    runner: (state, node) => {
      state.addNode("wikiLink", undefined, undefined, {
        target: node.attrs.target,
        alias: node.attrs.alias,
      });
    },
  },
}));

/** Al escribir `[[nota]]` se convierte en enlace. */
export const wikiLinkInputRule = $inputRule(
  (ctx) =>
    new InputRule(
      /\[\[([^[\]|\n]+?)(?:\|([^[\]\n]+?))?\]\]$/,
      (state, match, start, end) =>
        state.tr.replaceWith(
          start,
          end,
          wikiLinkSchema.type(ctx).create({
            target: match[1].trim(),
            alias: match[2]?.trim() || null,
          }),
        ),
    ),
);

export const wikiLink = [
  wikiLinkRemark,
  wikiLinkSchema,
  wikiLinkInputRule,
].flat();
