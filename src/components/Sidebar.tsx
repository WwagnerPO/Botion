import {
  CalendarDays,
  CheckSquare,
  ChevronsUpDown,
  Clock,
  FileText,
  Network,
  Star,
  type LucideIcon,
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
  /** Con Ctrl se abre en pestaña nueva y con Alt a la derecha. */
  onSelect: (path: string, e?: React.MouseEvent) => void;
  onSelectDatabase: (path: string, e?: React.MouseEvent) => void;
  favorites: string[];
  recents: string[];
  iconOf: (path: string) => string | undefined;
  onOpenVault: () => void;
  /** Nueva nota en `folder` (`""` es la raíz). */
  onNewNote: (folder?: string) => void;
  onNewFolder: () => void;
  onSearch: () => void;
  onCommands: () => void;
  onGraph: () => void;
  /** Abre (o crea) la nota de hoy. */
  onDaily: (e: React.MouseEvent) => void;
  /** Panel de tareas con fecha; `tasksDue` son las vencidas o de hoy. */
  onTasks: () => void;
  tasksDue: number;
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
  onGraph,
  onDaily,
  onTasks,
  tasksDue,
  onContextMenu,
  onMove,
  footer,
  favorites,
  recents,
  iconOf,
}: Props) {
  // Solo las que siguen existiendo en la bóveda.
  const existing = new Set<string>();
  const collect = (nodes: TreeNode[]) =>
    nodes.forEach((n) => (n.kind === "folder" ? collect(n.children) : existing.add(n.path)));
  collect(vault?.tree ?? []);
  const favs = favorites.filter((p) => existing.has(p));
  const recent = recents.filter((p) => existing.has(p) && !favs.includes(p)).slice(0, 5);
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
          <button type="button" onClick={onDaily} className={navItem}>
            <CalendarDays className="size-4" />
            <span className="flex-1">Nota de hoy</span>
          </button>
          <button type="button" onClick={onTasks} className={navItem}>
            <CheckSquare className="size-4" />
            <span className="flex-1">Tareas</span>
            {tasksDue > 0 && (
              <span className="rounded-full bg-orange-100 px-1.5 text-[11px] font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                {tasksDue}
              </span>
            )}
          </button>
          <button type="button" onClick={onGraph} className={navItem}>
            <Network className="size-4" />
            <span className="flex-1">Grafo</span>
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
        {vault && favs.length > 0 && (
          <PathSection title="Favoritas" Icon={Star} paths={favs} selected={selected} iconOf={iconOf} onSelect={onSelect} />
        )}
        {vault && recent.length > 0 && (
          <PathSection title="Recientes" Icon={Clock} paths={recent} selected={selected} iconOf={iconOf} onSelect={onSelect} />
        )}
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

/** Lista corta de notas (favoritas o recientes) encima del árbol. */
function PathSection({
  title,
  Icon,
  paths,
  selected,
  iconOf,
  onSelect,
}: {
  title: string;
  Icon: LucideIcon;
  paths: string[];
  selected: string | null;
  iconOf: (path: string) => string | undefined;
  onSelect: (path: string, e?: React.MouseEvent) => void;
}) {
  return (
    <section aria-label={title} className="mb-1">
      <p className="flex items-center gap-1.5 px-2 pt-2 pb-1 text-xs font-medium text-neutral-400">
        <Icon className="size-3" /> {title}
      </p>
      <ul>
        {paths.map((p) => {
          const icon = iconOf(p);
          return (
            <li key={p}>
              <button
                type="button"
                onClick={(e) => onSelect(p, e)}
                title={p}
                className={`flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left ${
                  selected === p
                    ? "bg-neutral-200/80 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50"
                    : "hover:bg-neutral-200/50 dark:hover:bg-neutral-800/70"
                }`}
              >
                {icon ? (
                  <span className="grid size-4 shrink-0 place-items-center text-[15px] leading-none">{icon}</span>
                ) : (
                  <FileText className="size-4 shrink-0 text-neutral-400" strokeWidth={1.75} />
                )}
                <span className="truncate">{p.split("/").pop()!.replace(/\.md$/i, "")}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
