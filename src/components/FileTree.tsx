import {
  ChevronRight,
  FileText,
  Folder as FolderIcon,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Table2,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { TreeNode } from "../lib/vault";

interface Props {
  nodes: TreeNode[];
  selected: string | null;
  onSelect: (path: string) => void;
  onSelectDatabase: (path: string) => void;
  onContextMenu: (node: TreeNode, e: React.MouseEvent) => void;
  /** Se suelta `path` (nota o carpeta) sobre la carpeta `folder`. */
  onMove: (path: string, folder: string) => void;
  /** Nueva nota dentro de una carpeta. */
  onNewNote: (folder: string) => void;
  depth?: number;
}

/** Tipo de datos al arrastrar notas y carpetas del árbol. */
export const TREE_DRAG = "text/x-botion-tree";

function dragProps(path: string) {
  return {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.stopPropagation();
      e.dataTransfer.setData(TREE_DRAG, path);
      e.dataTransfer.effectAllowed = "move";
    },
  };
}

const row = (active: boolean) =>
  `group/row relative flex h-7 items-center rounded-md pr-1 ${
    active
      ? "bg-neutral-200/80 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50"
      : "hover:bg-neutral-200/50 dark:hover:bg-neutral-800/70"
  }`;

const rowAction =
  "grid size-5 place-items-center rounded text-neutral-400 opacity-0 group-hover/row:opacity-100 focus:opacity-100 hover:bg-neutral-300/60 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200";

/** Botón «…» que abre el mismo menú que el clic derecho. */
function MoreButton({ onOpen }: { onOpen: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(e);
      }}
      className={rowAction}
      aria-label="Más acciones"
      title="Más acciones"
    >
      <MoreHorizontal className="size-3.5" />
    </button>
  );
}

const indent = (depth: number) => ({ paddingLeft: 4 + depth * 14 });

export function FileTree({
  nodes,
  selected,
  onSelect,
  onSelectDatabase,
  onContextMenu,
  onMove,
  onNewNote,
  depth = 0,
}: Props) {
  return (
    <ul>
      {nodes.map((node) =>
        node.kind === "folder" ? (
          <Folder
            key={node.path}
            node={node}
            selected={selected}
            onSelect={onSelect}
            onSelectDatabase={onSelectDatabase}
            onContextMenu={onContextMenu}
            onMove={onMove}
            onNewNote={onNewNote}
            depth={depth}
          />
        ) : (
          <li key={node.path} {...dragProps(node.path)}>
            <div
              className={row(selected === node.path)}
              style={indent(depth)}
              onContextMenu={(e) => onContextMenu(node, e)}
            >
              <button
                type="button"
                onClick={() => onSelect(node.path)}
                title={node.path}
                className="flex h-full min-w-0 flex-1 items-center gap-1.5 text-left"
              >
                <span className="w-4 shrink-0" />
                {node.icon ? (
                  <span className="grid size-4 shrink-0 place-items-center text-[15px] leading-none">
                    {node.icon}
                  </span>
                ) : (
                  <FileText className="size-4 shrink-0 text-neutral-400" strokeWidth={1.75} />
                )}
                <span className="truncate">{node.name}</span>
              </button>
              <MoreButton onOpen={(e) => onContextMenu(node, e)} />
            </div>
          </li>
        ),
      )}
    </ul>
  );
}

function Folder({
  node,
  selected,
  onSelect,
  onSelectDatabase,
  onContextMenu,
  onMove,
  onNewNote,
  depth,
}: Omit<Props, "nodes"> & {
  node: Extract<TreeNode, { kind: "folder" }>;
  depth: number;
}) {
  const containsSelected = !!selected?.startsWith(node.path + "/");
  const [open, setOpen] = useState(containsSelected);
  const [dropping, setDropping] = useState(false);

  // Abre la carpeta si se selecciona una nota de dentro (p. ej. al crearla).
  useEffect(() => {
    if (containsSelected) setOpen(true);
  }, [containsSelected]);

  const Icon = node.database ? Table2 : open ? FolderOpen : FolderIcon;

  return (
    <li
      {...dragProps(node.path)}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(TREE_DRAG)) return;
        e.preventDefault();
        e.stopPropagation();
        setDropping(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropping(false);
      }}
      onDrop={(e) => {
        const path = e.dataTransfer.getData(TREE_DRAG);
        setDropping(false);
        if (!path) return;
        e.preventDefault();
        e.stopPropagation();
        onMove(path, node.path);
        setOpen(true);
      }}
      className={dropping ? "rounded-md bg-violet-100 ring-1 ring-violet-300 dark:bg-violet-950 dark:ring-violet-800" : ""}
    >
      <div
        className={row(selected === node.path)}
        style={indent(depth)}
        onContextMenu={(e) => onContextMenu(node, e)}
      >
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={open ? "Plegar" : "Desplegar"}
          className="grid size-4 shrink-0 place-items-center rounded text-neutral-400 hover:bg-neutral-300/60 dark:hover:bg-neutral-700"
        >
          <ChevronRight
            className={`size-3 transition-transform ${open ? "rotate-90" : ""}`}
            strokeWidth={2.5}
          />
        </button>
        {/* Base de datos: el nombre abre la tabla; carpeta normal: la despliega. */}
        <button
          type="button"
          onClick={() => (node.database ? onSelectDatabase(node.path) : setOpen(!open))}
          className="ml-1.5 flex h-full min-w-0 flex-1 items-center gap-1.5 text-left"
          title={node.database ? "Abrir como base de datos" : node.path}
        >
          <Icon
            className={`size-4 shrink-0 ${node.database ? "text-violet-500" : "text-neutral-400"}`}
            strokeWidth={1.75}
          />
          <span className="truncate">{node.name}</span>
        </button>
        <MoreButton onOpen={(e) => onContextMenu(node, e)} />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNewNote(node.path);
          }}
          className={rowAction}
          aria-label={`Nueva nota en ${node.name}`}
          title="Nueva nota aquí"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      {open && (
        <FileTree
          nodes={node.children}
          selected={selected}
          onSelect={onSelect}
          onSelectDatabase={onSelectDatabase}
          onContextMenu={onContextMenu}
          onMove={onMove}
          onNewNote={onNewNote}
          depth={depth + 1}
        />
      )}
    </li>
  );
}
