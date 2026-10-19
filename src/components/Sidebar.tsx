import type { TreeNode, Vault } from "../lib/vault";
import { FileTree, TREE_DRAG } from "./FileTree";
import { ThemeToggle } from "./ThemeToggle";
import type { ReactNode } from "react";

interface Props {
  vault: Vault | null;
  selected: string | null;
  onSelect: (path: string) => void;
  onSelectDatabase: (path: string) => void;
  onOpenVault: () => void;
  onNewNote: () => void;
  onNewFolder: () => void;
  onSearch: () => void;
  /** Mover una nota o carpeta a otra carpeta (`""` es la raíz). */
  onMove: (path: string, folder: string) => void;
  /** Contenido extra al pie (estado de Git). */
  footer?: ReactNode;
  /** `node` es `null` al hacer clic derecho en una zona vacía. */
  onContextMenu: (node: TreeNode | null, e: React.MouseEvent) => void;
}

const iconButton =
  "rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100";

export function Sidebar({
  vault,
  selected,
  onSelect,
  onSelectDatabase,
  onOpenVault,
  onNewNote,
  onNewFolder,
  onSearch,
  onContextMenu,
  onMove,
  footer,
}: Props) {
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
      {vault && (
        <div className="flex items-center gap-1 px-3 pb-2">
          <button
            type="button"
            onClick={onSearch}
            className="mr-1 flex flex-1 items-center justify-between rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-400 hover:text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:text-neutral-200"
          >
            <span>Buscar</span>
            <kbd className="font-sans">Ctrl K</kbd>
          </button>
          <button
            type="button"
            onClick={onNewNote}
            className={iconButton}
            title="Nueva nota"
            aria-label="Nueva nota"
          >
            <svg
              viewBox="0 0 20 20"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path
                d="M5 2.75h6.5L15.25 6.5v10.75H5z M11.25 2.75V6.75h4 M10 9.5v5 M7.5 12h5"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={onNewFolder}
            className={iconButton}
            title="Nueva carpeta"
            aria-label="Nueva carpeta"
          >
            <svg
              viewBox="0 0 20 20"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path
                d="M2.75 5.25h5l1.5 1.75h8v9.25H2.75z M10 9.25v4.5 M7.75 11.5h4.5"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}
      <nav
        className="flex-1 overflow-y-auto px-2 pb-4 text-sm text-neutral-600 dark:text-neutral-400"
        onContextMenu={(e) => vault && onContextMenu(null, e)}
        // Soltar en una zona vacía mueve a la raíz de la bóveda.
        onDragOver={(e) => e.dataTransfer.types.includes(TREE_DRAG) && e.preventDefault()}
        onDrop={(e) => {
          const path = e.dataTransfer.getData(TREE_DRAG);
          if (path) {
            e.preventDefault();
            onMove(path, "");
          }
        }}
      >
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
            onSelectDatabase={onSelectDatabase}
            onMove={onMove}
            onContextMenu={(node, e) => {
              e.stopPropagation();
              onContextMenu(node, e);
            }}
          />
        )}
      </nav>
      <footer className="space-y-3 border-t border-neutral-200 p-3 dark:border-neutral-800">
        {footer}
        <ThemeToggle />
      </footer>
    </aside>
  );
}
