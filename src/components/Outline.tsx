import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { readingTime, type DocStats } from "../lib/outline";

interface Props {
  stats: DocStats | null;
  /** Zona con scroll de la nota y editor donde están los títulos. */
  scroller: HTMLElement | null;
  editor: HTMLElement | null;
  onClose: () => void;
}

const titles = (editor: HTMLElement | null) =>
  [...(editor?.querySelectorAll<HTMLElement>(".ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6") ?? [])];

/** Índice lateral: los títulos de la nota, el actual marcado, y las palabras. */
export function Outline({ stats, scroller, editor, onClose }: Props) {
  const [current, setCurrent] = useState(0);

  // El título actual es el último que ha pasado por arriba.
  useEffect(() => {
    if (!scroller) return;
    const onScroll = () => {
      const top = scroller.getBoundingClientRect().top + 90;
      const list = titles(editor);
      let i = 0;
      list.forEach((h, j) => {
        if (h.getBoundingClientRect().top <= top) i = j;
      });
      setCurrent(i);
    };
    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [scroller, editor, stats]);

  const headings = stats?.headings ?? [];
  const min = Math.min(...headings.map((h) => h.level), 6);

  return (
    <aside
      aria-label="Índice de la nota"
      className="no-print sticky top-14 mr-3 hidden h-fit self-start max-h-[calc(100vh-7rem)] w-56 shrink-0 flex-col overflow-hidden text-sm lg:flex"
    >
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="text-xs font-medium text-neutral-400">En esta nota</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar índice"
          className="grid size-6 place-items-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <nav className="min-h-0 overflow-y-auto">
        {headings.length === 0 && <p className="px-2 py-1 text-xs text-neutral-400">Sin títulos todavía.</p>}
        {headings.map((h, i) => (
          <button
            key={i}
            type="button"
            onClick={() => titles(editor)[i]?.scrollIntoView({ behavior: "smooth", block: "start" })}
            style={{ paddingLeft: `${0.5 + (h.level - min) * 0.75}rem` }}
            className={`block w-full truncate rounded-md py-1 pr-2 text-left ${
              i === current
                ? "bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50"
                : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            }`}
            title={h.text}
          >
            {h.text}
          </button>
        ))}
      </nav>
      {stats && (
        <p className="mt-2 border-t border-neutral-200 px-2 pt-2 text-xs text-neutral-400 dark:border-neutral-800">
          {stats.words.toLocaleString("es")} {stats.words === 1 ? "palabra" : "palabras"} · {readingTime(stats.words)}
        </p>
      )}
    </aside>
  );
}
