import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EMOJI_GROUPS, searchEmoji } from "../lib/emoji";

interface Props {
  /** Esquina superior izquierda del selector. */
  x: number;
  y: number;
  onPick: (emoji: string) => void;
  /** Si se da, aparece el botón «Quitar». */
  onRemove?: () => void;
  onClose: () => void;
}

/** Selector de emojis flotante, con búsqueda en español. */
export function EmojiPicker({ x, y, onPick, onRemove, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const groups = query.trim()
    ? [{ name: "Resultados", emojis: searchEmoji(query) }]
    : EMOJI_GROUPS;

  const pick = (emoji: string) => {
    onClose();
    onPick(emoji);
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Elegir emoji"
      style={{
        left: Math.max(8, Math.min(x, window.innerWidth - 336)),
        top: Math.max(8, Math.min(y, window.innerHeight - 380)),
      }}
      className="fixed z-50 flex h-[360px] w-80 animate-pop flex-col rounded-xl bg-white shadow-pop dark:bg-neutral-800"
    >
      <div className="flex items-center gap-2 border-b border-neutral-200 p-2 dark:border-neutral-700">
        <label className="flex flex-1 items-center gap-2 rounded-md bg-neutral-100 px-2 py-1 text-sm dark:bg-neutral-900">
          <Search className="size-3.5 text-neutral-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              const first = groups[0]?.emojis[0];
              if (e.key === "Enter" && first) pick(first.char);
            }}
            placeholder="Buscar emoji…"
            className="w-full bg-transparent outline-none placeholder:text-neutral-400"
          />
        </label>
        {onRemove && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onRemove();
            }}
            className="rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            Quitar
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {groups.map((g) => (
          <section key={g.name} className="mb-2">
            <h3 className="px-1 pb-1 text-xs font-medium text-neutral-400">
              {g.name}
            </h3>
            {g.emojis.length === 0 && (
              <p className="px-1 text-sm text-neutral-400">Sin resultados.</p>
            )}
            <div className="grid grid-cols-8">
              {g.emojis.map((e) => (
                <button
                  key={g.name + e.char}
                  type="button"
                  onClick={() => pick(e.char)}
                  title={e.words}
                  aria-label={e.words.split(" ")[0]}
                  className="grid size-9 place-items-center rounded-md text-xl hover:bg-neutral-100 dark:hover:bg-neutral-700"
                >
                  {e.char}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
