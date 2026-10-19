import { $nodeSchema, $remark } from "@milkdown/kit/utils";

/**
 * Incrustaciones `![[nota]]` en una línea propia, como en Obsidian. Con una
 * barra al final (`![[Tareas/]]`) se incrusta la vista de una base de datos.
 * Se guardan tal cual; el contenido se dibuja con un NodeView (ver Editor).
 */

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  target?: string;
}

const EMBED = /^!\[\[([^[\]\n]+?)\]\]$/;

/** Párrafo que solo contiene `![[...]]` (antes o después de leer los enlaces). */
function embedTarget(paragraph: MdNode): string | null {
  const kids = paragraph.children ?? [];
  if (kids.length === 1 && kids[0].type === "text") {
    const m = EMBED.exec(kids[0].value!.trim());
    return m ? m[1].trim() : null;
  }
  if (
    kids.length === 2 &&
    kids[0].type === "text" &&
    kids[0].value === "!" &&
    kids[1].type === "wikiLink"
  ) {
    return kids[1].target ?? null;
  }
  return null;
}

function transform(node: MdNode) {
  if (!node.children) return;
  node.children = node.children.map((child) => {
    if (child.type === "paragraph") {
      const target = embedTarget(child);
      if (target) return { type: "embed", target };
    }
    transform(child);
    return child;
  });
}

function remarkEmbed(this: { data: () => Record<string, unknown[] | undefined> }) {
  const data = this.data();
  (data.toMarkdownExtensions ??= []).push({
    handlers: { embed: (node: MdNode) => `![[${node.target}]]` },
  });
  return (tree: MdNode) => transform(tree);
}

// Los tipos de unified no encajan con un plugin escrito a mano.
export const embedRemark = $remark("embed", () => remarkEmbed as never);

export const embedSchema = $nodeSchema("embed", () => ({
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  attrs: { target: { default: "" } },
  parseDOM: [
    {
      tag: "div[data-embed]",
      getAttrs: (dom) => ({ target: (dom as HTMLElement).dataset.embed ?? "" }),
    },
  ],
  toDOM: (node) => ["div", { class: "embed", "data-embed": node.attrs.target }],
  parseMarkdown: {
    match: (node) => node.type === "embed",
    runner: (state, node, type) => {
      state.addNode(type, { target: node.target as string });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "embed",
    runner: (state, node) => {
      state.addNode("embed", undefined, undefined, { target: node.attrs.target });
    },
  },
}));

export const embed = [embedRemark, embedSchema].flat();

/** Destino de una base de datos incrustada: termina en «/». */
export const isDatabaseEmbed = (target: string) => target.endsWith("/");
