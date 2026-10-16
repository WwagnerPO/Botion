import type { Backlink } from "../lib/vault";

interface Props {
  backlinks: Backlink[];
  onSelect: (path: string) => void;
}

export function Backlinks({ backlinks, onSelect }: Props) {
  return (
    <section className="mx-14 mt-4 mb-16 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      <h2 className="mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
        Enlaces a esta nota ({backlinks.length})
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
                className="w-full rounded px-2 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <span className="block text-sm font-medium">{b.name}</span>
                <span className="block truncate text-xs text-neutral-500">
                  {b.snippet}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
