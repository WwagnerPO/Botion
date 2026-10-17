import { useEffect, useRef, useState } from "react";
import { searchNotes, type SearchHit } from "../lib/vault";

interface Props {
  onOpen: (path: string) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
  /** Texto del campo de búsqueda vacío. */
  placeholder?: string;
}

type Item = { kind: "hit"; hit: SearchHit } | { kind: "create"; name: string };

/** Quita marcas de Markdown que solo ensucian el fragmento. */
function cleanSnippet(text: string) {
  return text
    .replace(/(^|\n)\s*-{3,}\s*(?=\n|$)/g, "$1")
    .replace(/(^|\n)\s*(#{1,6}|>|[-*+]( \[[ xX]\])?|\d+\.)\s+/g, "$1")
    .replace(/\*\*|__|\[\[|\]\]|`/g, "")
    .replace(/\s*\n\s*/g, " · ")
    .replace(/^( · )+|( · )+$/g, "")
    .replace(/( · )+/g, " · ");
}

/** Muestra el fragmento resaltando las coincidencias, sin usar HTML. */
function Snippet({ text }: { text: string }) {
  const parts = cleanSnippet(text).split(/(\u0002[^\u0003]*\u0003)/);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("\u0002") ? (
          <mark
            key={i}
            className="rounded-sm bg-yellow-200/70 text-inherit dark:bg-yellow-500/30"
          >
            {part.slice(1, -1)}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function folderOf(path: string) {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

export function SearchPalette({
  onOpen,
  onCreate,
  onClose,
  placeholder = "Buscar o crear una nota…",
}: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  // Busca mientras se escribe; descarta respuestas de consultas antiguas.
  useEffect(() => {
    let current = true;
    const timer = window.setTimeout(() => {
      searchNotes(query)
        .then((result) => {
          if (current) {
            setHits(result);
            setActive(0);
          }
        })
        .catch(() => current && setHits([]));
    }, 80);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const name = query.trim();
  const exists = hits.some((h) => h.name.toLowerCase() === name.toLowerCase());
  const items: Item[] = [
    ...hits.map((hit) => ({ kind: "hit" as const, hit })),
    ...(name && !exists ? [{ kind: "create" as const, name }] : []),
  ];

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(item: Item | undefined) {
    if (!item) return;
    onClose();
    if (item.kind === "hit") onOpen(item.hit.path);
    else onCreate(item.name);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar notas"
        className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded="true"
          aria-controls="search-results"
          aria-activedescendant={items.length ? `search-item-${active}` : undefined}
          className="border-b border-neutral-200 bg-transparent px-4 py-3 text-base outline-none dark:border-neutral-800"
        />
        <ul
          ref={listRef}
          id="search-results"
          role="listbox"
          className="flex-1 overflow-y-auto p-1"
        >
          {!query && hits.length > 0 && (
            <li className="px-3 pt-2 pb-1 text-xs font-medium text-neutral-400">
              Recientes
            </li>
          )}
          {items.map((item, i) => (
            <li
              key={item.kind === "hit" ? item.hit.path : "__create"}
              id={`search-item-${i}`}
              data-index={i}
              role="option"
              aria-selected={i === active}
              onMouseMove={() => setActive(i)}
              onClick={() => choose(item)}
              className={`cursor-pointer rounded-md px-3 py-2 ${
                i === active ? "bg-neutral-100 dark:bg-neutral-800" : ""
              }`}
            >
              {item.kind === "hit" ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-medium">
                      {item.hit.name}
                    </span>
                    <span className="truncate text-xs text-neutral-400">
                      {folderOf(item.hit.path)}
                    </span>
                  </div>
                  {item.hit.snippet && (
                    <div className="mt-0.5 line-clamp-2 text-xs text-neutral-500">
                      <Snippet text={item.hit.snippet} />
                    </div>
                  )}
                </>
              ) : (
                <span className="text-sm">
                  <span className="text-neutral-400">Crear nota </span>«
                  {item.name}»
                </span>
              )}
            </li>
          ))}
          {query && items.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-neutral-400">
              Sin resultados
            </li>
          )}
        </ul>
        <div className="flex gap-4 border-t border-neutral-200 px-4 py-2 text-xs text-neutral-400 dark:border-neutral-800">
          <span>↑↓ moverse</span>
          <span>↵ abrir</span>
          <span>Esc cerrar</span>
        </div>
      </div>
    </div>
  );
}
