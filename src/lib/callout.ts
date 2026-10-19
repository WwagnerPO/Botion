import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, Selection, type EditorState } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $nodeSchema, $prose, $remark } from "@milkdown/kit/utils";

/**
 * Avisos y desplegables con la sintaxis de Obsidian:
 *
 * ```markdown
 * > [!tip] Título opcional
 * > Texto del aviso.
 *
 * > [!note]- Desplegable (cerrado al abrir la nota)
 * > Contenido.
 * ```
 *
 * En el editor son un nodo propio, para que al guardar se escriba la
 * cabecera `[!tipo]` tal cual (Milkdown escaparía los corchetes).
 */

export const CALLOUT_TYPES = {
  note: { label: "Nota", icon: "ℹ️" },
  tip: { label: "Consejo", icon: "💡" },
  warning: { label: "Aviso", icon: "⚠️" },
  danger: { label: "Peligro", icon: "⛔" },
} as const;

export type CalloutType = keyof typeof CALLOUT_TYPES;

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  calloutType?: string;
  fold?: string;
}

const HEADER = /^\[!([\w-]+)\]([+-]?)[ \t]*/;

/** Convierte las citas que empiezan por `[!tipo]` en nodos `callout`. */
function toCallout(quote: MdNode): MdNode | null {
  const first = quote.children?.[0];
  const text = first?.type === "paragraph" ? first.children?.[0] : undefined;
  if (text?.type !== "text" || !text.value) return null;
  const match = HEADER.exec(text.value);
  if (!match) return null;

  // La primera línea (tras la cabecera) es el título; el resto, contenido.
  const inline = [...first!.children!];
  inline[0] = { type: "text", value: text.value.slice(match[0].length) };
  const title: MdNode[] = [];
  const rest: MdNode[] = [];
  let inTitle = true;
  for (const node of inline) {
    if (inTitle && node.type === "text" && node.value!.includes("\n")) {
      const i = node.value!.indexOf("\n");
      if (i > 0) title.push({ type: "text", value: node.value!.slice(0, i) });
      const after = node.value!.slice(i + 1);
      if (after) rest.push({ type: "text", value: after });
      inTitle = false;
    } else if (inTitle && node.type === "break") {
      inTitle = false;
    } else {
      (inTitle ? title : rest).push(node);
    }
  }
  const nonEmpty = (nodes: MdNode[]) =>
    nodes.filter((n) => n.type !== "text" || n.value !== "");

  const body = [
    ...(nonEmpty(rest).length ? [{ type: "paragraph", children: nonEmpty(rest) }] : []),
    ...quote.children!.slice(1),
  ];
  return {
    type: "callout",
    calloutType: match[1].toLowerCase(),
    fold: match[2],
    children: [
      { type: "calloutTitle", children: nonEmpty(title) },
      ...(body.length ? body : [{ type: "paragraph", children: [] }]),
    ],
  };
}

function transform(node: MdNode) {
  if (!node.children) return;
  node.children = node.children.map((child) => {
    transform(child);
    return child.type === "blockquote" ? (toCallout(child) ?? child) : child;
  });
}

type ToMarkdownState = {
  enter: (name: string) => () => void;
  containerFlow: (parent: MdNode, info: unknown) => string;
  containerPhrasing: (parent: MdNode, info: unknown) => string;
  indentLines: (value: string, map: (line: string, i: number, blank: boolean) => string) => string;
};

/** Escribe el aviso como cita con la cabecera `[!tipo]` sin escapar. */
function calloutToMarkdown(node: MdNode, _parent: unknown, state: ToMarkdownState, info: unknown) {
  const exit = state.enter("blockquote");
  const [titleNode, ...all] = node.children ?? [];
  // Un párrafo vacío (Milkdown lo guardaría como «<br />») no se escribe.
  const isEmpty = (n: MdNode) =>
    n.type === "paragraph" &&
    (n.children ?? []).every(
      (c) => (c.type === "text" && !c.value?.trim()) || (c.type === "html" && /^<br\s*\/?>$/i.test(c.value ?? "")),
    );
  const body = all.filter((n) => !isEmpty(n));
  const title = titleNode
    ? state.containerPhrasing(titleNode, { before: " ", after: "\n" })
    : "";
  const content = state.containerFlow({ type: "root", children: body }, info);
  exit();
  const header = `[!${node.calloutType}]${node.fold ?? ""}${title ? ` ${title}` : ""}`;
  return state.indentLines(content ? `${header}\n${content}` : header, (line, _i, blank) =>
    blank ? ">" : `> ${line}`,
  );
}

function remarkCallout(this: { data: () => Record<string, unknown[] | undefined> }) {
  const data = this.data();
  (data.toMarkdownExtensions ??= []).push({
    handlers: { callout: calloutToMarkdown },
  });
  return (tree: MdNode) => transform(tree);
}

// Los tipos de unified no encajan con un plugin escrito a mano.
export const calloutRemark = $remark("callout", () => remarkCallout as never);

export const calloutTitleSchema = $nodeSchema("callout_title", () => ({
  content: "inline*",
  defining: true,
  parseDOM: [{ tag: "div.callout-title" }],
  toDOM: () => ["div", { class: "callout-title" }, 0],
  parseMarkdown: {
    match: (node) => node.type === "calloutTitle",
    runner: (state, node, type) => {
      state.openNode(type);
      state.next(node.children);
      state.closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "callout_title",
    runner: (state, node) => {
      state.openNode("calloutTitle");
      state.next(node.content);
      state.closeNode();
    },
  },
}));

export const calloutSchema = $nodeSchema("callout", () => ({
  group: "block",
  content: "callout_title block+",
  defining: true,
  attrs: {
    calloutType: { default: "note" },
    fold: { default: "" },
  },
  parseDOM: [
    {
      tag: "div.callout",
      getAttrs: (dom) => ({
        calloutType: (dom as HTMLElement).dataset.callout ?? "note",
        fold: (dom as HTMLElement).dataset.fold ?? "",
      }),
    },
  ],
  toDOM: (node) => [
    "div",
    {
      class: "callout",
      "data-callout": node.attrs.calloutType,
      "data-fold": node.attrs.fold,
    },
    0,
  ],
  parseMarkdown: {
    match: (node) => node.type === "callout",
    runner: (state, node, type) => {
      state.openNode(type, {
        calloutType: node.calloutType as string,
        fold: (node.fold as string) ?? "",
      });
      state.next(node.children);
      state.closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "callout",
    runner: (state, node) => {
      state.openNode("callout", undefined, {
        calloutType: node.attrs.calloutType,
        fold: node.attrs.fold,
      });
      state.next(node.content);
      state.closeNode();
    },
  },
}));

/**
 * Abre y cierra los desplegables en pantalla. El estado no se guarda en el
 * fichero (allí solo cuenta si empieza abierto `+` o cerrado `-`), y el
 * desplegable que tiene el cursor dentro se mantiene abierto para editarlo.
 */
export const calloutFoldKey = new PluginKey<Set<number>>("calloutFold");

function foldDecorations(state: EditorState, toggled: Set<number>) {
  const { from, to } = state.selection;
  const decorations: Decoration[] = [];
  state.doc.descendants((node: ProseNode, pos: number) => {
    if (node.type.name !== "callout" || !node.attrs.fold) return;
    const end = pos + node.nodeSize;
    const startsOpen = node.attrs.fold === "+";
    const editing = from > pos && to < end;
    const open = editing || (toggled.has(pos) ? !startsOpen : startsOpen);
    decorations.push(Decoration.node(pos, end, { class: open ? "is-open" : "is-closed" }));
  });
  return DecorationSet.create(state.doc, decorations);
}

export const calloutFold = $prose(
  () =>
    new Plugin<Set<number>>({
      key: calloutFoldKey,
      state: {
        init: () => new Set(),
        apply: (tr, toggled) => {
          const next = new Set<number>();
          for (const pos of toggled) next.add(tr.mapping.map(pos));
          const flip = tr.getMeta(calloutFoldKey) as number | undefined;
          if (flip !== undefined) {
            if (next.has(flip)) next.delete(flip);
            else next.add(flip);
          }
          return next;
        },
      },
      props: {
        decorations: (state) => foldDecorations(state, calloutFoldKey.getState(state)!),
        handleDOMEvents: {
          // Clic en la flecha del título: abre o cierra sin mover el cursor.
          mousedown: (view, event) => {
            const title = (event.target as HTMLElement).closest?.(".callout-title");
            const box = title?.parentElement;
            if (!title || !box?.dataset.fold) return false;
            if (event.clientX - title.getBoundingClientRect().left > 24) return false;
            const pos = view.posAtDOM(box, 0) - 1;
            const node = view.state.doc.nodeAt(pos);
            if (node?.type.name !== "callout") return false;
            event.preventDefault();
            // Si el cursor está dentro, se lleva justo detrás para poder cerrarlo.
            let tr = view.state.tr.setMeta(calloutFoldKey, pos);
            const { from } = view.state.selection;
            if (from > pos && from < pos + node.nodeSize) {
              tr = tr.setSelection(Selection.near(tr.doc.resolve(pos + node.nodeSize)));
            }
            view.dispatch(tr);
            return true;
          },
        },
      },
    }),
);

export const callout = [calloutRemark, calloutTitleSchema, calloutSchema, calloutFold].flat();

/** Markdown de un aviso nuevo, para insertarlo desde el menú «/». */
export function calloutMarkdown(type: CalloutType, fold = "", title = "") {
  return `> [!${type}]${fold}${title ? ` ${title}` : ""}\n> Escribe aquí…\n`;
}
