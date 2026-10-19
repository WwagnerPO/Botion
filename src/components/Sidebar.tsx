import {
  ChevronsUpDown,
  Command,
  FilePlus2,
  FolderPlus,
  FolderOpen,
  Search,
  SquarePen,
} from "lucide-react";
import type { ReactNode } from "react";
import type { TreeNode, Vault } from "../lib/vault";
import { FileTree, TREE_DRAG } from "./FileTree";
import { ThemeToggle } from "./ThemeToggle";

interface Props {
  vault: Vault | null;
  selected: string | null;
  onSelect: (path: string) => void;
  onSelectDatabase: (path: string) => void;
  onOpenVault: () => void;
  /** Nueva nota en `folder` (`""` es la raíz). */
  onNewNote: (folder?: string) => void;
  onNewFolder: () => void;
  onSearch: () => void;
  onCommands: () => void;
  /** Mover una nota o carpeta a otra carpeta (`""` es la raíz). */
  onMove: (path: string, folder: string) => void;
  /** Contenido extra al pie (estado de Git). */
  footer?: ReactNode;
  /** `node` es `null` al hacer clic derecho en una zona vacía. */
  onContextMenu: (node: TreeNode | null, e: React.MouseEvent) => void;
}

export const iconButton =
  "grid size-6 shrink-0 place-items-center rounded-md text-neutral-400 hover:bg-neutral-200/80 hover:text-neutral-700 dark:hover:bg-neutral-700/60 dark:hover:text-neutral-200";

const navItem =
  "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100";

export function Sidebar({
  vault,
  selected,
  onSelect,
  onSelectDatabase,
  onOpenVault,
  onNewNote,
  onNewFolder,
  onSearch,
  onCommands,
  onContextMenu,
  onMove,
  footer,
}: Props) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-200/80 bg-neutral-50 text-sm dark:border-neutral-800 dark:bg-neutral-900">
      <header className="flex items-center gap-1 px-2 pt-2 pb-1">
        <button
          type="button"
          onClick={onOpenVault}
          title={vault ? `${vault.root}\nCambiar de bóveda` : "Abrir una carpeta"}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 hover:bg-neutral-200/60 dark:hover:bg-neutral-800"
        >
          <span className="grid size-5 shrink-0 place-items-center rounded bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[11px] font-semibold text-white shadow-sm">
            {(vault?.name ?? "B").charAt(0).toUpperCase()}
          </span>
          <span className="truncate font-semibold text-neutral-800 dark:text-neutral-100">
            {vault ? vault.name : "Botion"}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-neutral-400" />
        </button>
        {vault && (
          <button
            type="button"
            onClick={() => onNewNote()}
            className={iconButton}
            title="Nueva nota (Ctrl+N)"
            aria-label="Nueva nota"
          >
            <SquarePen className="size-4" />
          </button>
        )}
      </header>

      {vault && (
        <div className="px-2 pb-2">
          <button type="button" onClick={onSearch} className={navItem}>
            <Search className="size-4" />
            <span className="flex-1">Buscar</span>
            <kbd>Ctrl K</kbd>
          </button>
          <button type="button" onClick={onCommands} className={navItem}>
            <Command className="size-4" />
            <span className="flex-1">Comandos</span>
            <kbd>Ctrl P</kbd>
          </button>
        </div>
      )}

      <nav
        className="flex-1 overflow-y-auto px-2 pb-4 text-neutral-600 dark:text-neutral-400"
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
        {vault && (
          <div className="group/section flex items-center justify-between px-2 pt-2 pb-1">
            <span className="text-xs font-medium text-neutral-400">Notas</span>
            <span className="flex gap-0.5 opacity-0 transition-opacity group-hover/section:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={() => onNewNote()}
                className={iconButton}
                title="Nueva nota"
                aria-label="Nueva nota en la raíz"
              >
                <FilePlus2 className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={onNewFolder}
                className={iconButton}
                title="Nueva carpeta"
                aria-label="Nueva carpeta"
              >
                <FolderPlus className="size-3.5" />
              </button>
            </span>
          </div>
        )}
        {!vault && (
          <div className="mt-6 px-3 text-center text-neutral-500">
            <p>Aún no hay ninguna bóveda abierta.</p>
            <button
              type="button"
              onClick={onOpenVault}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-neutral-700 shadow-sm hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              <FolderOpen className="size-4" />
              Abrir carpeta
            </button>
          </div>
        )}
        {vault && vault.tree.length === 0 && (
          <p className="px-2 py-1 text-neutral-400">
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
            onNewNote={onNewNote}
            onContextMenu={(node, e) => {
              e.stopPropagation();
              onContextMenu(node, e);
            }}
          />
        )}
      </nav>
      <footer className="space-y-2 border-t border-neutral-200/80 p-2 dark:border-neutral-800">
        {footer}
        <ThemeToggle />
      </footer>
    </aside>
  );
}
