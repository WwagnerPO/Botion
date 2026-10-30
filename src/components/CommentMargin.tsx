import { MessageSquare, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Popover } from "./Popover";

export interface MarginComment {
  pos: number;
  text: string;
}

interface Props {
  root: HTMLElement | null;
  comments: MarginComment[];
  /** Posición del comentario que se está editando. */
  editing: number | null;
  coordsOf: (pos: number) => { top: number; bottom: number; left: number } | null;
  onEdit: (pos: number | null) => void;
  onSave: (pos: number, text: string) => void;
  onDelete: (pos: number) => void;
}

const CARD = 64;

/**
 * Comentarios al margen de la nota, a la altura de su 💬. Si no hay sitio a
 * la derecha solo se ven en el texto (al pulsar el 💬 se abren).
 */
export function CommentMargin({ root, comments, editing, coordsOf, onEdit, onSave, onDelete }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState<{ pos: number; text: string; top: number }[]>([]);
  const [fits, setFits] = useState(false);

  useLayoutEffect(() => {
    const layout = () => {
      const wrapper = box.current?.parentElement;
      if (!root || !wrapper) return;
      const r = root.getBoundingClientRect();
      const outline = document.querySelector('[aria-label="Índice de la nota"]')?.getBoundingClientRect().left;
      const scroller = root.closest(".overflow-y-auto")?.getBoundingClientRect().right ?? window.innerWidth;
      setFits(Math.min(outline ?? Infinity, scroller) - r.right >= 240);
      const base = wrapper.getBoundingClientRect().top;
      let next = -Infinity;
      setCards(
        comments
          .map((c) => ({ ...c, top: (coordsOf(c.pos)?.top ?? base) - base }))
          .sort((a, b) => a.top - b.top)
          .map((c) => {
            const top = Math.max(c.top - 6, next);
            next = top + CARD + 8;
            return { ...c, top };
          }),
      );
    };
    layout();
    window.addEventListener("resize", layout);
    return () => window.removeEventListener("resize", layout);
    // coordsOf cambia en cada render; los comentarios marcan cuándo recolocar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, root]);

  const current = editing === null ? null : comments.find((c) => c.pos === editing);
  const at = editing === null ? null : coordsOf(editing);

  return (
    <div ref={box} className="no-print">
      {fits &&
        cards.map((c) => (
          <button
            key={c.pos}
            type="button"
            onClick={() => onEdit(c.pos)}
            style={{ top: c.top, height: CARD }}
            className={`absolute left-full ml-4 w-56 overflow-hidden rounded-lg border px-2.5 py-1.5 text-left text-xs leading-snug shadow-sm transition-colors ${
              editing === c.pos
                ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950"
                : "border-neutral-200 bg-white hover:border-amber-300 dark:border-neutral-800 dark:bg-neutral-900"
            }`}
          >
            <span className="mb-0.5 flex items-center gap-1 text-[11px] text-neutral-400">
              <MessageSquare className="size-3" /> Comentario
            </span>
            <span className="line-clamp-2 text-neutral-700 dark:text-neutral-200">{c.text || "Vacío"}</span>
          </button>
        ))}
      {current && at && (
        <CommentEditor
          key={current.pos}
          anchor={new DOMRect(at.left, at.top, 16, at.bottom - at.top)}
          text={current.text}
          onClose={(text) => {
            onEdit(null);
            if (!text.trim()) onDelete(current.pos);
            else if (text !== current.text) onSave(current.pos, text.trim());
          }}
          onDelete={() => {
            onEdit(null);
            onDelete(current.pos);
          }}
        />
      )}
    </div>
  );
}

function CommentEditor({
  anchor,
  text,
  onClose,
  onDelete,
}: {
  anchor: DOMRect;
  text: string;
  onClose: (text: string) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(text);
  const ref = useRef(draft);
  ref.current = draft;
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    area.current?.focus();
    area.current?.select();
  }, []);
  return (
    <Popover anchor={anchor} onClose={() => onClose(ref.current)} className="w-72 p-2">
      <textarea
        ref={area}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onClose(ref.current);
        }}
        rows={3}
        placeholder="Escribe un comentario…"
        aria-label="Comentario"
        className="w-full resize-none rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-sm outline-none focus:border-violet-400 dark:border-neutral-700 dark:bg-neutral-900"
      />
      <div className="mt-1 flex items-center justify-between text-xs text-neutral-400">
        <span>
          <kbd>Ctrl Enter</kbd> guardar
        </span>
        <button type="button" onClick={onDelete} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950">
          <Trash2 className="size-3.5" /> Borrar
        </button>
      </div>
    </Popover>
  );
}
