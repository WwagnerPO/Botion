import { useEffect, useState } from "react";
import type { TreeNode } from "../lib/vault";

interface Props {
  nodes: TreeNode[];
  selected: string | null;
  onSelect: (path: string) => void;
  onContextMenu: (node: TreeNode, e: React.MouseEvent) => void;
  depth?: number;
}

export function FileTree({
  nodes,
  selected,
  onSelect,
  onContextMenu,
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
            onContextMenu={onContextMenu}
            depth={depth}
          />
        ) : (
          <li key={node.path}>
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
  onContextMenu,
  depth,
}: Omit<Props, "nodes"> & {
  node: Extract<TreeNode, { kind: "folder" }>;
  depth: number;
}) {
  const containsSelected = !!selected?.startsWith(node.path + "/");
  const [open, setOpen] = useState(containsSelected);

  // Abre la carpeta si se selecciona una nota de dentro (p. ej. al crearla).
  useEffect(() => {
    if (containsSelected) setOpen(true);
  }, [containsSelected]);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onContextMenu={(e) => onContextMenu(node, e)}
        aria-expanded={open}
        className="flex w-full items-center gap-1 truncate rounded px-2 py-1 text-left hover:bg-neutral-200/70 dark:hover:bg-neutral-800"
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <span
          className={`inline-block w-3 text-[10px] text-neutral-400 transition-transform ${open ? "rotate-90" : ""}`}
        >
          ▶
        </span>
        <span className="truncate">{node.name}</span>
      </button>
      {open && (
        <FileTree
          nodes={node.children}
          selected={selected}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
          depth={depth + 1}
        />
      )}
    </li>
  );
}
