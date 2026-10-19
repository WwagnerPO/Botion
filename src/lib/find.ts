import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection, type EditorState } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

/** Buscar dentro de la nota (Ctrl+F), sin distinguir mayúsculas ni tildes. */

interface FindState {
  query: string;
  matches: { from: number; to: number }[];
  current: number;
}

export const findKey = new PluginKey<FindState>("find");

/** Carácter sin tildes y en minúsculas (puede quedar vacío, p. ej. una tilde suelta). */
const fold = (c: string) =>
  c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function search(doc: ProseNode, query: string) {
  const q = Array.from(query).map(fold).join("");
  const matches: { from: number; to: number }[] = [];
  if (!q) return matches;
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // Texto plegado del bloque y la posición de cada carácter en el documento.
    let text = "";
    const at: number[] = [];
    node.forEach((child, offset) => {
      if (!child.isText) return;
      let i = 0;
      for (const ch of child.text!) {
        const f = fold(ch);
        for (const _ of f) {
          text += _;
          at.push(pos + 1 + offset + i);
        }
        i += ch.length;
      }
    });
    let from = text.indexOf(q);
    while (from !== -1) {
      const last = at[from + q.length - 1];
      matches.push({ from: at[from], to: last + 1 });
      from = text.indexOf(q, from + q.length);
    }
    return false;
  });
  return matches;
}

function decorations(state: EditorState) {
  const find = findKey.getState(state);
  if (!find?.matches.length) return DecorationSet.empty;
  return DecorationSet.create(
    state.doc,
    find.matches.map((m, i) =>
      Decoration.inline(m.from, m.to, {
        class: i === find.current ? "find-match find-current" : "find-match",
      }),
    ),
  );
}

export const findPlugin = $prose(
  () =>
    new Plugin<FindState>({
      key: findKey,
      state: {
        init: () => ({ query: "", matches: [], current: 0 }),
        apply: (tr, prev, _old, state) => {
          const meta = tr.getMeta(findKey) as Partial<FindState> | undefined;
          if (!meta && !tr.docChanged) return prev;
          const query = meta?.query ?? prev.query;
          const matches = search(state.doc, query);
          const current = Math.min(meta?.current ?? prev.current, Math.max(matches.length - 1, 0));
          return { query, matches, current };
        },
      },
      props: { decorations },
    }),
);

/** Cambia lo que se busca y salta al primer resultado. */
export function setFindQuery(view: EditorView, query: string) {
  view.dispatch(view.state.tr.setMeta(findKey, { query, current: 0 }));
  revealCurrent(view);
}

/** Siguiente (+1) o anterior (-1) resultado, dando la vuelta. */
export function moveFind(view: EditorView, step: number) {
  const find = findKey.getState(view.state);
  if (!find?.matches.length) return;
  const n = find.matches.length;
  view.dispatch(view.state.tr.setMeta(findKey, { current: (find.current + step + n) % n }));
  revealCurrent(view);
}

function revealCurrent(view: EditorView) {
  const find = findKey.getState(view.state);
  const m = find?.matches[find.current];
  if (!m) return;
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, m.from, m.to)).scrollIntoView(),
  );
}

export function findCounts(state: EditorState) {
  const find = findKey.getState(state);
  return { total: find?.matches.length ?? 0, current: find?.current ?? 0 };
}
