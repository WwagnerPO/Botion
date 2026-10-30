import { Fragment, type Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, type EditorState } from "@milkdown/kit/prose/state";
import { Mapping } from "@milkdown/kit/prose/transform";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { DONE_MARK, repeatRule, shiftedDates } from "./recurrence";
import { today } from "./slashCommands";

/**
 * Tareas con fecha en el editor: `📅 2026-10-31`, `⏰ … 09:00` y `🔁 cada
 * semana` se ven como etiquetas (en rojo si ya han vencido), y al marcar una
 * tarea que se repite se crea encima la siguiente repetición.
 */

const MARK = /(📅|⏰)\s*(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?|🔁\s*[^📅⏰✅🔁]+|✅\s*\d{4}-\d{2}-\d{2}/gu;

const key = new PluginKey("taskDates");

function decorations(state: EditorState) {
  const day = today();
  const out: Decoration[] = [];
  state.doc.descendants((node, pos, parent, index) => {
    if (!node.isText) return true;
    const text = node.text!;
    // Identificador de bloque sincronizado al final del párrafo: «^abc123».
    const id = /\s(\^[A-Za-z0-9-]+)\s*$/.exec(text);
    if (id && parent && index === parent.childCount - 1) {
      const from = pos + id.index + 1;
      out.push(Decoration.inline(from, from + id[1].length, { class: "block-id" }));
    }
    for (const m of text.matchAll(MARK)) {
      const raw = m[0].replace(/\s+$/, "");
      const from = pos + m.index;
      let cls = "task-chip";
      if (raw.startsWith("🔁")) cls += " task-repeat";
      else if (raw.startsWith("✅")) cls += " task-done";
      else if (m[2] < day) cls += " task-overdue";
      else if (m[2] === day) cls += " task-today";
      out.push(Decoration.inline(from, from + raw.length, { class: cls }));
    }
    return false;
  });
  return DecorationSet.create(state.doc, out);
}

/** Copia el contenido cambiando las fechas en el texto. */
function shift(content: Fragment, shifts: { from: string; to: string }[]): Fragment {
  const out: ProseNode[] = [];
  content.forEach((n) => {
    if (n.isText) {
      let t = n.text!;
      for (const s of shifts) t = t.replace(s.from, s.to);
      out.push(n.type.schema.text(t, n.marks));
    } else {
      out.push(n.copy(shift(n.content, shifts)));
    }
  });
  return Fragment.from(out);
}

export const taskDates = $prose(
  () =>
    new Plugin({
      key,
      state: {
        init: (_, state) => decorations(state),
        apply: (tr, old, _o, state) => (tr.docChanged ? decorations(state) : old),
      },
      props: {
        decorations: (state) => key.getState(state),
      },
      // Al marcar una tarea con 🔁: se apunta cuándo se hizo y se crea la siguiente.
      appendTransaction: (trs, oldState, newState) => {
        if (!trs.some((t) => t.docChanged) || trs.some((t) => t.getMeta(key))) return null;
        const mapping = new Mapping();
        trs.forEach((t) => mapping.appendMapping(t.mapping));
        const back = mapping.invert();
        const found: { pos: number; node: ProseNode }[] = [];
        newState.doc.descendants((node, pos) => {
          if (node.type.name !== "list_item") return true;
          const text = node.firstChild?.textContent ?? "";
          if (node.attrs.checked === true && text.includes("🔁") && !text.includes(DONE_MARK)) {
            const old = oldState.doc.nodeAt(back.map(pos));
            if (old?.type === node.type && old.attrs.checked === false) found.push({ pos, node });
          }
          return true;
        });
        if (found.length === 0) return null;
        const tr = newState.tr.setMeta(key, true);
        for (const { pos, node } of found.reverse()) {
          const para = node.firstChild!;
          tr.insertText(` ${DONE_MARK} ${today()}`, pos + para.nodeSize);
          const text = para.textContent;
          const rule = repeatRule(text);
          const shifts = rule ? shiftedDates(text, rule) : null;
          if (shifts) tr.insert(pos, node.type.create({ ...node.attrs, checked: false }, shift(node.content, shifts)));
        }
        return tr;
      },
    }),
);
