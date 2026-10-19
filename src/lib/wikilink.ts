import { InputRule } from "@milkdown/kit/prose/inputrules";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $inputRule, $nodeSchema, $prose, $remark } from "@milkdown/kit/utils";

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
    // [[#Sección]] se ve como «Sección».
    node.attrs.alias || String(node.attrs.target).replace(/^#/, ""),
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

/** Clave para pedir que se vuelva a mirar qué enlaces existen. */
export const wikiLinkStatusKey = new PluginKey<DecorationSet>("wikiLinkStatus");

/**
 * Marca con la clase `wikilink-missing` los enlaces a notas que aún no
 * existen. `exists` se consulta cada vez, así que puede cambiar con el árbol.
 */
export function wikiLinkStatus(exists: () => (target: string) => boolean) {
  const build = (doc: ProseNode) => {
    const check = exists();
    const decorations: Decoration[] = [];
    doc.descendants((node, pos) => {
      if (node.type.name === "wikilink" && !check(node.attrs.target)) {
        decorations.push(
          Decoration.node(pos, pos + node.nodeSize, { class: "wikilink-missing" }),
        );
      }
    });
    return DecorationSet.create(doc, decorations);
  };

  return $prose(
    () =>
      new Plugin<DecorationSet>({
        key: wikiLinkStatusKey,
        state: {
          init: (_, state) => build(state.doc),
          apply: (tr, old) =>
            tr.docChanged || tr.getMeta(wikiLinkStatusKey)
              ? build(tr.doc)
              : old.map(tr.mapping, tr.doc),
        },
        props: {
          decorations: (state) => wikiLinkStatusKey.getState(state),
        },
      }),
  );
}

/**
 * Comprueba si un enlace apunta a alguna nota, con las mismas reglas que
 * Rust: por nombre en cualquier carpeta, o por ruta (completa o final).
 */
export function linkChecker(notePaths: string[]) {
  const noExt = notePaths.map((p) => p.replace(/\.md$/i, "").toLowerCase());
  const stems = new Set(noExt.map((p) => p.split("/").pop()!));
  return (target: string) => {
    const t = target.split("#")[0].trim().replace(/\.md$/i, "").toLowerCase();
    if (!t) return true;
    if (!t.includes("/")) return stems.has(t);
    return noExt.some((p) => p === t || p.endsWith("/" + t));
  };
}
