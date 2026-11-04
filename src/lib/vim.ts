import { redo, undo } from "@milkdown/kit/prose/history";
import { Plugin, PluginKey, Selection, TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

/**
 * Atajos de Vim opcionales en el editor: modo normal (moverse y editar con
 * teclas) y modo insertar (escribir como siempre).
 *
 * Normal: h j k l · w b e · 0 ^ $ · gg G · i a I A o O · x · dd · u · Ctrl+R.
 * Esc vuelve a normal.
 */

export type VimMode = "normal" | "insert";

interface VimState {
  mode: VimMode;
  /** Primera tecla de una orden de dos (`gg`, `dd`). */
  pending: string;
}

export const vimKey = new PluginKey<VimState>("vim");

type Dir = "forward" | "backward";
type Unit = "character" | "word" | "line" | "lineboundary";

/** Mueve el cursor como el navegador (palabras, líneas visuales) y lo pasa a ProseMirror. */
function move(view: EditorView, dir: Dir, unit: Unit) {
  const sel = view.dom.ownerDocument.getSelection() as (globalThis.Selection & { modify?: (a: string, d: string, u: string) => void }) | null;
  if (!sel?.modify || !sel.focusNode) return;
  sel.modify("move", dir, unit);
  if (!sel.focusNode || !view.dom.contains(sel.focusNode)) return;
  const pos = view.posAtDOM(sel.focusNode, sel.focusOffset);
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)).scrollIntoView());
}

function set(view: EditorView, patch: Partial<VimState>) {
  view.dispatch(view.state.tr.setMeta(vimKey, patch));
}

/** Pulsa Intro como si fuera el teclado (respeta listas, tareas…). */
function enter(view: EditorView) {
  const event = new KeyboardEvent("keydown", { key: "Enter" });
  view.someProp("handleKeyDown", (f) => f(view, event));
}

/** Borra el párrafo (o el elemento de lista) del cursor. */
function deleteLine(view: EditorView) {
  const { $from } = view.state.selection;
  let depth = $from.depth;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === "list_item") {
      depth = d;
      break;
    }
  }
  const from = $from.before(depth);
  const to = $from.after(depth);
  const tr = view.state.tr.delete(from, to);
  view.dispatch(tr.setSelection(Selection.near(tr.doc.resolve(Math.min(from, tr.doc.content.size)))).scrollIntoView());
}

export function vimPlugin(enabled: () => boolean, onMode: (mode: VimMode | null) => void) {
  return $prose(
    () =>
      new Plugin<VimState>({
        key: vimKey,
        state: {
          init: () => ({ mode: "normal", pending: "" }),
          apply: (tr, value) => {
            const patch = tr.getMeta(vimKey) as Partial<VimState> | undefined;
            return patch ? { ...value, ...patch } : value;
          },
        },
        view: (view) => {
          let last: VimMode | null | undefined;
          const report = () => {
            const mode = enabled() ? vimKey.getState(view.state)!.mode : null;
            if (mode !== last) onMode((last = mode));
          };
          report();
          return { update: report, destroy: () => onMode(null) };
        },
        props: {
          attributes: (state): Record<string, string> =>
            enabled() ? { class: `vim-${vimKey.getState(state)!.mode}` } : {},
          handleKeyDown: (view, e) => {
            if (!enabled() || e.isComposing) return false;
            const { mode, pending } = vimKey.getState(view.state)!;
            if (mode === "insert") {
              if (e.key === "Escape" || (e.ctrlKey && e.key === "[")) {
                set(view, { mode: "normal", pending: "" });
                move(view, "backward", "character");
                return true;
              }
              return false;
            }
            if (e.ctrlKey && e.key.toLowerCase() === "r") {
              redo(view.state, view.dispatch);
              return true;
            }
            // Los demás atajos (Ctrl+K, Ctrl+P…) siguen funcionando.
            if (e.ctrlKey || e.metaKey || e.altKey) return false;
            if (e.key.length !== 1 && e.key !== "Enter" && e.key !== "Backspace") return false;
            const key = e.key;
            if (pending) {
              set(view, { pending: "" });
              if (pending === "g" && key === "g") view.dispatch(view.state.tr.setSelection(Selection.atStart(view.state.doc)).scrollIntoView());
              if (pending === "d" && key === "d") deleteLine(view);
              return true;
            }
            const insert = () => set(view, { mode: "insert" });
            switch (key) {
              case "h":
              case "Backspace":
                move(view, "backward", "character");
                break;
              case "l":
              case " ":
                move(view, "forward", "character");
                break;
              case "j":
              case "Enter":
                move(view, "forward", "line");
                break;
              case "k":
                move(view, "backward", "line");
                break;
              case "w":
              case "e":
                move(view, "forward", "word");
                break;
              case "b":
                move(view, "backward", "word");
                break;
              case "0":
              case "^":
                move(view, "backward", "lineboundary");
                break;
              case "$":
                move(view, "forward", "lineboundary");
                break;
              case "G":
                view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)).scrollIntoView());
                break;
              case "g":
              case "d":
                set(view, { pending: key });
                break;
              case "i":
                insert();
                break;
              case "a":
                move(view, "forward", "character");
                insert();
                break;
              case "I":
                move(view, "backward", "lineboundary");
                insert();
                break;
              case "A":
                move(view, "forward", "lineboundary");
                insert();
                break;
              case "o":
                move(view, "forward", "lineboundary");
                insert();
                enter(view);
                break;
              case "O":
                move(view, "backward", "lineboundary");
                insert();
                enter(view);
                move(view, "backward", "line");
                break;
              case "x": {
                const { from, $from } = view.state.selection;
                if (from < $from.end()) view.dispatch(view.state.tr.delete(from, from + 1));
                break;
              }
              case "u":
                undo(view.state, view.dispatch);
                break;
            }
            // En modo normal las demás letras no escriben.
            return true;
          },
        },
      }),
  );
}
