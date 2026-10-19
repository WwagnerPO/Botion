import { FileText, Table2, X } from "lucide-react";
import type { Tab } from "../lib/navigation";

interface Props {
  tabs: Tab[];
  active: number;
  iconOf: (path: string) => string | undefined;
  onSelect: (index: number) => void;
  onClose: (index: number) => void;
}

/** Pestañas abiertas (solo se ven si hay más de una). */
export function TabBar({ tabs, active, iconOf, onSelect, onClose }: Props) {
  if (tabs.length < 2) return null;
  return (
    <div role="tablist" aria-label="Pestañas" className="no-print flex h-9 shrink-0 items-end gap-0.5 overflow-x-auto border-b border-neutral-200 bg-neutral-50 px-2 dark:border-neutral-800 dark:bg-neutral-900">
      {tabs.map((t, i) => {
        const name = t.path.split("/").pop()!.replace(/\.md$/i, "");
        const icon = t.kind === "note" ? iconOf(t.path) : undefined;
        const on = i === active;
        return (
          <div
            key={`${i}-${t.path}`}
            role="tab"
            aria-selected={on}
            title={t.path}
            onMouseDown={(e) => {
              // Botón central: cerrar, como en los navegadores.
              if (e.button === 1) {
                e.preventDefault();
                onClose(i);
              }
            }}
            onClick={() => onSelect(i)}
            className={`group flex h-8 max-w-52 min-w-28 cursor-default items-center gap-1.5 rounded-t-md border border-b-0 px-2.5 text-sm ${
              on
                ? "border-neutral-200 bg-white text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50"
                : "border-transparent text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            {t.kind === "database" ? (
              <Table2 className="size-3.5 shrink-0 text-violet-500" />
            ) : icon ? (
              <span className="text-[13px] leading-none">{icon}</span>
            ) : (
              <FileText className="size-3.5 shrink-0 text-neutral-400" />
            )}
            <span className="min-w-0 flex-1 truncate">{name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose(i);
              }}
              aria-label={`Cerrar ${name}`}
              className={`grid size-4 shrink-0 place-items-center rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 ${on ? "" : "opacity-0 group-hover:opacity-100"}`}
            >
              <X className="size-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
