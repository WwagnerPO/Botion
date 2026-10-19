import { ArrowUpLeft, FileText } from "lucide-react";
import type { Backlink } from "../lib/vault";

interface Props {
  backlinks: Backlink[];
  onSelect: (path: string) => void;
}

export function Backlinks({ backlinks, onSelect }: Props) {
  return (
    <section className="no-print mx-14 mt-4 mb-16 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      <h2 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
        <ArrowUpLeft className="size-3.5" />
        Enlaces a esta nota
        <span className="rounded-full bg-neutral-100 px-1.5 text-[11px] text-neutral-500 dark:bg-neutral-800">
          {backlinks.length}
        </span>
      </h2>
      {backlinks.length === 0 ? (
        <p className="text-sm text-neutral-400">
          Ninguna nota enlaza aquí todavía.
        </p>
      ) : (
        <ul className="space-y-1">
          {backlinks.map((b) => (
            <li key={b.path}>
              <button
                type="button"
                onClick={() => onSelect(b.path)}
                className="flex w-full gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <FileText className="mt-0.5 size-4 shrink-0 text-neutral-400" strokeWidth={1.75} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{b.name}</span>
                  <span className="block truncate text-xs text-neutral-500">
                    {b.snippet}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
