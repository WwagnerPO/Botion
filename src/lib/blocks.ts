import type { Node as ProseNode, Schema } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

/** Tipos a los que se puede convertir un bloque («Convertir en…»). */
export const BLOCK_KINDS = [
  { kind: "paragraph", label: "Texto" },
  { kind: "h1", label: "Título 1" },
  { kind: "h2", label: "Título 2" },
  { kind: "h3", label: "Título 3" },
  { kind: "bullet", label: "Lista con viñetas" },
  { kind: "ordered", label: "Lista numerada" },
  { kind: "task", label: "Lista de tareas" },
  { kind: "quote", label: "Cita" },
  { kind: "code", label: "Código" },
] as const;

export type BlockKind = (typeof BLOCK_KINDS)[number]["kind"];

/** Bloque de primer nivel en `pos`: su posición y el nodo. */
export function topBlockAt(view: EditorView, pos: number) {
  const $pos = view.state.doc.resolve(Math.min(pos, view.state.doc.content.size));
  if ($pos.depth === 0) {
    const node = $pos.nodeAfter;
    return node ? { from: pos, node } : null;
  }
  return { from: $pos.before(1), node: $pos.node(1) };
}

/** Párrafos, títulos y código que hay dentro de un bloque. */
function textblocks(node: ProseNode): ProseNode[] {
  if (node.isTextblock) return [node];
  const out: ProseNode[] = [];
  node.descendants((child) => {
    if (child.isTextblock) {
      out.push(child);
      return false;
    }
    return true;
  });
  return out;
}

function build(schema: Schema, parts: ProseNode[], kind: BlockKind): ProseNode[] {
  const { nodes } = schema;
  // El código no admite marcas: se pasa a texto plano.
  const inline = (tb: ProseNode) => (tb.type.name === "code_block" ? (tb.textContent ? schema.text(tb.textContent) : null) : tb.content);
  const para = (tb: ProseNode) => nodes.paragraph.create(null, inline(tb));
  const list = (type: "bullet_list" | "ordered_list", checked: boolean | null) =>
    nodes[type].create(
      null,
      parts.map((tb) => nodes.list_item.create(checked === null ? null : { checked }, para(tb))),
    );
  switch (kind) {
    case "paragraph": return parts.map(para);
    case "h1":
    case "h2":
    case "h3": {
      const level = Number(kind[1]);
      return parts.map((tb) => nodes.heading.create({ level }, inline(tb)));
    }
    case "bullet": return [list("bullet_list", null)];
    case "ordered": return [list("ordered_list", null)];
    case "task": return [list("bullet_list", false)];
    case "quote": return [nodes.blockquote.create(null, parts.map(para))];
    case "code": {
      const text = parts.map((tb) => tb.textContent).join("\n");
      return [nodes.code_block.create({ language: "" }, text ? schema.text(text) : null)];
    }
  }
}

/** Convierte el bloque de primer nivel de `pos` conservando su texto. */
export function convertBlock(view: EditorView, pos: number, kind: BlockKind) {
  const block = topBlockAt(view, pos);
  if (!block) return;
  const parts = textblocks(block.node);
  if (parts.length === 0) return;
  const replacement = build(view.state.schema, parts, kind);
  const tr = view.state.tr.replaceWith(block.from, block.from + block.node.nodeSize, replacement);
  const end = Math.min(block.from + replacement.reduce((n, r) => n + r.nodeSize, 0) - 1, tr.doc.content.size);
  view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(Math.max(block.from + 1, end)), -1)).scrollIntoView());
  view.focus();
}

export function duplicateBlock(view: EditorView, pos: number) {
  const block = topBlockAt(view, pos);
  if (!block) return;
  view.dispatch(view.state.tr.insert(block.from + block.node.nodeSize, block.node.copy(block.node.content)));
  view.focus();
}

export function deleteBlock(view: EditorView, pos: number) {
  const block = topBlockAt(view, pos);
  if (!block) return;
  let tr = view.state.tr.delete(block.from, block.from + block.node.nodeSize);
  // El documento no puede quedarse vacío.
  if (tr.doc.childCount === 0) tr = tr.insert(0, view.state.schema.nodes.paragraph.create());
  view.dispatch(tr);
  view.focus();
}

// ---------------------------------------------------------------------------
// Menciones con «@»

/** Lo que se inserta al elegir una mención. */
export type Mention = { kind: "note"; target: string } | { kind: "date"; text: string };

export const mentionKey = new PluginKey("mention");

/**
 * Al escribir «@» al principio de una palabra se llama a `onMention` con
 * la posición de la arroba, para elegir una nota o una fecha.
 */
export function mentionPlugin(onMention: (pos: number, view: EditorView) => void) {
  return $prose(
    () =>
      new Plugin({
        key: mentionKey,
        props: {
          handleTextInput: (view, from, _to, text) => {
            if (text !== "@") return false;
            const $from = view.state.doc.resolve(from);
            if ($from.parent.type.name === "code_block") return false;
            const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 1), $from.parentOffset, undefined, "￼");
            if (before && !/\s/.test(before)) return false;
            // La arroba se escribe normal; luego se sustituye por la mención.
            setTimeout(() => onMention(from, view));
            return false;
          },
        },
      }),
  );
}
