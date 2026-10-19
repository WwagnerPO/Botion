import { useRef, useState } from "react";
import { valueText, type Column, type Row } from "../lib/database";
import { cell } from "../lib/dbview";
import { CellView, Pill } from "./PropertyInput";
import type { ViewProps } from "./viewProps";

const NONE = "\u0000sin-valor";

/** Columnas por las que se puede agrupar el kanban. */
export function groupableColumns(columns: Column[]) {
  return columns.filter((c) => c.kind === "select" || c.kind === "text");
}

/** Vista kanban: una columna por cada valor de una propiedad de selección. */
export function BoardView({
  db,
  view,
  rows,
  ctx,
  columns,
  options,
  onPeek,
  onOpenLink,
  onChangeValue,
  onNewRow,
}: ViewProps) {
  const [dragOver, setDragOver] = useState<string | null>(null);
  // Columnas ya vistas, para que no desaparezcan al vaciarlas arrastrando.
  const seen = useRef(new Map<string, Set<string>>());
  const candidates = groupableColumns(db.columns);
  const column =
    candidates.find((c) => c.name === view.group_by) ??
    candidates.find((c) => c.kind === "select") ??
    candidates[0];

  if (!column) {
    return (
      <p className="text-sm text-neutral-500">
        Añade una propiedad de tipo Selección para agrupar las notas en el
        kanban.
      </p>
    );
  }

  const known = seen.current.get(column.name) ?? new Set<string>();
  for (const o of options[column.name] ?? []) known.add(o);
  seen.current.set(column.name, known);
  const groups = [NONE, ...[...known].sort((a, b) => a.localeCompare(b, "es"))];
  const groupOf = (row: Row) => valueText(row.props[column.name]) || NONE;
  const others = columns.filter((c) => c.name !== column.name).slice(0, 4);

  function drop(e: React.DragEvent, group: string) {
    e.preventDefault();
    setDragOver(null);
    const path = e.dataTransfer.getData("text/x-botion-row");
    const row = rows.find((r) => r.path === path);
    if (row && groupOf(row) !== group) {
      onChangeValue(path, column!.name, group === NONE ? null : group);
    }
  }

  return (
    <div>
      <div className="flex items-start gap-3 overflow-x-auto pb-4">
        {groups.map((group) => {
          const cards = rows.filter((r) => groupOf(r) === group);
          return (
            <section
              key={group}
              aria-label={group === NONE ? "Sin valor" : group}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(group);
              }}
              onDragLeave={() => setDragOver((g) => (g === group ? null : g))}
              onDrop={(e) => drop(e, group)}
              className={`w-64 shrink-0 rounded-xl p-2 transition-colors ${
                dragOver === group
                  ? "bg-violet-100 ring-1 ring-violet-300 dark:bg-violet-950 dark:ring-violet-800"
                  : "bg-neutral-50 dark:bg-neutral-900"
              }`}
            >
              <header className="mb-2 flex items-center gap-2 px-1 text-sm">
                {group === NONE ? (
                  <span className="text-neutral-500">Sin valor</span>
                ) : (
                  <Pill text={group} />
                )}
                <span className="text-xs text-neutral-400">{cards.length}</span>
              </header>
              <ul className="space-y-2">
                {cards.map((row) => (
                  <li
                    key={row.path}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/x-botion-row", row.path);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="cursor-grab rounded-lg bg-white p-2.5 shadow-[0_0_0_1px_rgb(15_15_15/0.06),0_2px_4px_rgb(15_15_15/0.06)] transition-shadow hover:shadow-[0_0_0_1px_rgb(15_15_15/0.08),0_4px_10px_rgb(15_15_15/0.1)] active:cursor-grabbing dark:bg-neutral-800 dark:shadow-[0_0_0_1px_rgb(255_255_255/0.06)]"
                  >
                    <button
                      type="button"
                      onClick={() => onPeek(row.path)}
                      className="flex w-full items-center gap-1.5 truncate text-left text-sm font-medium hover:underline"
                    >
                      {typeof row.props.icono === "string" && <span>{row.props.icono}</span>}
                      <span className="truncate">{row.name}</span>
                    </button>
                    {others.map((c) => {
                      const v = cell(row, c, ctx);
                      if (!v.error && (valueText(v.value) === "" || v.value === false)) return null;
                      return (
                        <div key={c.name} className="mt-1 -mx-1.5 text-xs text-neutral-500" title={c.name}>
                          <CellView kind={c.kind} value={v.value} error={v.error} alignNumbers={false} onOpenLink={onOpenLink} notePath={row.path} />
                        </div>
                      );
                    })}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() =>
                  onNewRow(group === NONE ? {} : { [column.name]: group })
                }
                className="mt-2 w-full rounded-md px-2 py-1 text-left text-sm text-neutral-400 hover:bg-neutral-200/60 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              >
                + Nueva
              </button>
            </section>
          );
        })}
      </div>
    </div>
  );
}
