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

export function FileTree({
  nodes,
  selected,
  onSelect,
  onSelectDatabase,
  onContextMenu,
  onMove,
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
            depth={depth}
          />
        ) : (
          <li key={node.path} {...dragProps(node.path)}>
            <button
              type="button"
              onClick={() => onSelect(node.path)}
              onContextMenu={(e) => onContextMenu(node, e)}
              title={node.path}
              className={`flex w-full items-center gap-1.5 truncate rounded px-2 py-1 text-left hover:bg-neutral-200/70 dark:hover:bg-neutral-800 ${
                selected === node.path
                  ? "bg-neutral-200 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                  : ""
              }`}
              style={{ paddingLeft: 8 + depth * 14 + 16 }}
            >
              <span className="truncate">{node.name}</span>
            </button>
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

  const arrow = (
    <span
      className={`inline-block w-3 text-[10px] text-neutral-400 transition-transform ${open ? "rotate-90" : ""}`}
    >
      ▶
    </span>
  );

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
      className={dropping ? "rounded bg-violet-100 dark:bg-violet-950" : ""}
    >
      {node.database ? (
        // Base de datos: la flecha despliega las notas y el nombre abre la tabla.
        <div
          className={`flex items-center rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 ${
            selected === node.path
              ? "bg-neutral-200 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
              : ""
          }`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onContextMenu={(e) => onContextMenu(node, e)}
        >
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? "Plegar" : "Desplegar"}
            className="py-1 pr-1"
          >
            {arrow}
          </button>
          <button
            type="button"
            onClick={() => onSelectDatabase(node.path)}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-2 text-left"
            title="Abrir como tabla"
          >
            <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="1.4">
              <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.5" />
              <path d="M1.75 6.5h12.5M6 6.5v6.75" />
            </svg>
            <span className="truncate">{node.name}</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          onContextMenu={(e) => onContextMenu(node, e)}
          aria-expanded={open}
          className="flex w-full items-center gap-1 truncate rounded px-2 py-1 text-left hover:bg-neutral-200/70 dark:hover:bg-neutral-800"
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          {arrow}
          <span className="truncate">{node.name}</span>
        </button>
      )}
      {open && (
        <FileTree
          nodes={node.children}
          selected={selected}
          onSelect={onSelect}
          onSelectDatabase={onSelectDatabase}
          onContextMenu={onContextMenu}
          onMove={onMove}
          depth={depth + 1}
        />
      )}
    </li>
  );
}
