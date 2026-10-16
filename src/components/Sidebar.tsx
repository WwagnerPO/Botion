import type { Vault } from "../lib/vault";
import { FileTree } from "./FileTree";

interface Props {
  vault: Vault | null;
  selected: string | null;
  onSelect: (path: string) => void;
  onOpenVault: () => void;
}

export function Sidebar({ vault, selected, onSelect, onOpenVault }: Props) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <span className="truncate text-sm font-semibold" title={vault?.root}>
          {vault ? vault.name : "Botion"}
        </span>
        <button
          type="button"
          onClick={onOpenVault}
          className="shrink-0 rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          {vault ? "Cambiar" : "Abrir carpeta"}
        </button>
      </header>
      <nav className="flex-1 overflow-y-auto px-2 pb-4 text-sm text-neutral-600 dark:text-neutral-400">
        {!vault && (
          <p className="px-2 py-1 text-neutral-500">
            Aún no hay ninguna bóveda abierta.
          </p>
        )}
        {vault && vault.tree.length === 0 && (
          <p className="px-2 py-1 text-neutral-500">
            Esta carpeta no tiene notas .md.
          </p>
        )}
        {vault && (
          <FileTree
            nodes={vault.tree}
            selected={selected}
            onSelect={onSelect}
          />
        )}
      </nav>
    </aside>
  );
}
