import { FileText, Plus } from "lucide-react";
import { COMPUTED_KINDS, type Column, type Props, type Row } from "../lib/database";
import { cell, groupRows, type Group } from "../lib/dbview";
import { coverBackground, COVER_KEY, ICON_KEY } from "../lib/cover";
import { CellView } from "./PropertyInput";
import type { ViewProps } from "./viewProps";

/** Grupos de la vista (o uno solo con todas las filas). */
function useGroups({ db, view, rows, ctx }: ViewProps): { groups: Group[]; column?: Column } {
  const column = view.group_by ? db.columns.find((c) => c.name === view.group_by) : undefined;
  return { column, groups: column ? groupRows(rows, column, ctx) : [{ key: "\u0000todas", rows }] };
}

function presetFor(column: Column | undefined, g: Group): Props {
  if (!column || g.key === null || g.key === "\u0000todas" || COMPUTED_KINDS.has(column.kind)) return {};
  return { [column.name]: column.kind === "tags" ? [g.key] : column.kind === "checkbox" ? g.key === "Marcada" : g.key };
}

function GroupTitle({ column, group }: { column?: Column; group: Group }) {
  if (!column) return null;
  return (
    <h3 className="mt-5 mb-2 flex items-center gap-2 text-sm font-medium first:mt-0">
      {group.key ?? <span className="text-neutral-400">Sin {column.name}</span>}
      <span className="text-xs font-normal text-neutral-400">{group.rows.length}</span>
    </h3>
  );
}

/** Valores no vacíos de las columnas visibles, para tarjetas y listas. */
function Values({ row, columns, ctx, onOpenLink, max }: { row: Row; columns: Column[]; ctx: ViewProps["ctx"]; onOpenLink: (t: string) => void; max: number }) {
  const shown = columns
    .map((c) => ({ c, v: cell(row, c, ctx) }))
    .filter(({ v }) => v.error || !(v.value === null || v.value === "" || (Array.isArray(v.value) && !v.value.length)))
    .slice(0, max);
  return (
    <>
      {shown.map(({ c, v }) => (
        <div key={c.name} className="min-w-0 text-xs text-neutral-600 dark:text-neutral-300" title={c.name}>
          <CellView kind={c.kind} value={v.value} error={v.error} alignNumbers={false} onOpenLink={onOpenLink} notePath={row.path} />
        </div>
      ))}
    </>
  );
}

export function GalleryView(props: ViewProps) {
  const { columns, ctx, vaultRoot, onPeek, onNewRow, onOpenLink } = props;
  const { groups, column } = useGroups(props);
  return (
    <div>
      {groups.map((g) => (
        <section key={g.key ?? "\u0000vacío"}>
          <GroupTitle column={column} group={g} />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {g.rows.map((row) => {
              const cover = row.props[COVER_KEY];
              const icon = row.props[ICON_KEY];
              return (
                <article
                  key={row.path}
                  className="group overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgb(15_15_15/0.08),0_2px_4px_rgb(15_15_15/0.05)] transition-shadow hover:shadow-[0_0_0_1px_rgb(15_15_15/0.1),0_6px_16px_rgb(15_15_15/0.1)] dark:bg-neutral-900 dark:shadow-[0_0_0_1px_rgb(255_255_255/0.08)]"
                >
                  <button type="button" onClick={() => onPeek(row.path)} className="block w-full text-left">
                    <div
                      className="grid h-28 place-items-center bg-neutral-100 text-4xl dark:bg-neutral-800"
                      style={typeof cover === "string" ? { background: coverBackground(cover, vaultRoot, row.path) } : undefined}
                    >
                      {typeof cover !== "string" &&
                        (typeof icon === "string" ? icon : <FileText className="size-8 text-neutral-300 dark:text-neutral-600" strokeWidth={1.5} />)}
                    </div>
                    <div className="px-3 pt-2 pb-1">
                      <p className="truncate font-medium">
                        {typeof icon === "string" && typeof cover === "string" && <span className="mr-1">{icon}</span>}
                        {row.name}
                      </p>
                    </div>
                  </button>
                  <div className="space-y-0.5 px-1.5 pb-2">
                    <Values row={row} columns={columns} ctx={ctx} onOpenLink={onOpenLink} max={4} />
                  </div>
                </article>
              );
            })}
            <button
              type="button"
              onClick={() => onNewRow(presetFor(column, g))}
              className="flex min-h-40 items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              <Plus className="size-4" /> Nueva
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}

export function ListView(props: ViewProps) {
  const { columns, ctx, onPeek, onNewRow, onOpenLink } = props;
  const { groups, column } = useGroups(props);
  return (
    <div>
      {groups.map((g) => (
        <section key={g.key ?? "\u0000vacío"}>
          <GroupTitle column={column} group={g} />
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
            {g.rows.map((row) => {
              const icon = row.props[ICON_KEY];
              return (
                <li key={row.path} className="flex min-h-9 items-center gap-3 rounded-md px-2 hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <button type="button" onClick={() => onPeek(row.path)} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left">
                    {typeof icon === "string" ? (
                      <span className="w-4 text-center">{icon}</span>
                    ) : (
                      <FileText className="size-4 shrink-0 text-neutral-400" strokeWidth={1.75} />
                    )}
                    <span className="truncate font-medium">{row.name}</span>
                  </button>
                  <div className="flex max-w-[60%] shrink-0 items-center gap-1 overflow-hidden">
                    <Values row={row} columns={columns} ctx={ctx} onOpenLink={onOpenLink} max={4} />
                  </div>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => onNewRow(presetFor(column, g))}
            className="mt-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700 dark:hover:bg-neutral-900"
          >
            <Plus className="size-4" /> Nueva
          </button>
        </section>
      ))}
    </div>
  );
}
