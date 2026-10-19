import { ChevronRight, Maximize2, Plus } from "lucide-react";
import { useState } from "react";
import {
  COMPUTED_KINDS,
  KIND_LABELS,
  type Column,
  type PropValue,
  type Props,
  type Row,
} from "../lib/database";
import { TOTALS, cell, groupRows, total, totalsFor, type Group } from "../lib/dbview";
import { ColumnIcon } from "./ColumnMenu";
import { Popover, PopoverItem } from "./Popover";
import { CellView, PropertyInput } from "./PropertyInput";
import type { ViewProps } from "./viewProps";

const NAME_WIDTH = 260;
const COL_WIDTH = 180;
const MIN_WIDTH = 70;
/** Tipo de datos al arrastrar la cabecera de una columna. */
const COLUMN_DRAG = "text/x-botion-column";

export function TableView({
  db,
  view,
  rows,
  ctx,
  columns,
  options,
  onOpenNote,
  onOpenLink,
  onPeek,
  onChangeValue,
  onNewRow,
  onUpdateView,
  onColumnMenu,
  onAddColumn,
  onReorder,
}: ViewProps & {
  /** Abre el menú de una columna (`null` = Nombre). */
  onColumnMenu: (column: Column | null, anchor: HTMLElement) => void;
  onAddColumn: () => void;
  /** Mueve la columna `name` delante de `before` (o al final). */
  onReorder: (name: string, before: string | null) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [totalMenu, setTotalMenu] = useState<{ column: Column; anchor: HTMLElement } | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const width = (name: string) => view.widths[name] ?? (name === "" ? NAME_WIDTH : COL_WIDTH);

  /** Arrastrar el borde derecho de la cabecera cambia el ancho. */
  function startResize(name: string, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const start = width(name);
    const th = (e.currentTarget as HTMLElement).parentElement!;
    const move = (ev: PointerEvent) => {
      th.style.width = `${Math.max(MIN_WIDTH, start + ev.clientX - startX)}px`;
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const w = Math.max(MIN_WIDTH, Math.round(start + ev.clientX - startX));
      if (w !== start) onUpdateView({ widths: { ...view.widths, [name]: w } });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const groupColumn = view.group_by ? db.columns.find((c) => c.name === view.group_by) : undefined;
  const groups: Group[] = groupColumn ? groupRows(rows, groupColumn, ctx) : [{ key: "\u0000todas", rows }];

  const headerCell =
    "group/th relative border-r border-neutral-200 p-0 text-left font-normal dark:border-neutral-800";
  const headerButton =
    "flex w-full items-center gap-1.5 truncate px-2 py-1.5 text-[13px] text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800";
  const sortMark = (name: string) =>
    view.sort?.column === name ? <span className="text-neutral-400">{view.sort.desc ? "↓" : "↑"}</span> : null;

  const presetFor = (g: Group): Props =>
    groupColumn && g.key !== null && g.key !== "\u0000todas" && !COMPUTED_KINDS.has(groupColumn.kind)
      ? {
          [groupColumn.name]:
            groupColumn.kind === "tags" ? [g.key] : groupColumn.kind === "checkbox" ? g.key === "Marcada" : g.key,
        }
      : {};

  return (
    <div className="overflow-x-auto pb-2">
      <table className="border-collapse text-sm" style={{ tableLayout: "fixed", width: "max-content" }}>
        <colgroup>
          <col style={{ width: width("") }} />
          {columns.map((c) => (
            <col key={c.name} style={{ width: width(c.name) }} />
          ))}
          <col style={{ width: 44 }} />
        </colgroup>
        <thead>
          <tr className="border-y border-neutral-200 dark:border-neutral-800">
            <th className={headerCell} style={{ width: width("") }}>
              <button type="button" className={headerButton} onClick={(e) => onColumnMenu(null, e.currentTarget)}>
                <ColumnIcon kind={null} /> Nombre {sortMark("")}
              </button>
              <span onPointerDown={(e) => startResize("", e)} className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-violet-400/50" />
            </th>
            {columns.map((c) => (
              <th
                key={c.name}
                className={`${headerCell} ${dropOn === c.name ? "shadow-[inset_2px_0_0_#8b5cf6]" : ""}`}
                style={{ width: width(c.name) }}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(COLUMN_DRAG, c.name);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (!e.dataTransfer.types.includes(COLUMN_DRAG)) return;
                  e.preventDefault();
                  setDropOn(c.name);
                }}
                onDragLeave={() => setDropOn((d) => (d === c.name ? null : d))}
                onDrop={(e) => {
                  const name = e.dataTransfer.getData(COLUMN_DRAG);
                  setDropOn(null);
                  if (name && name !== c.name) onReorder(name, c.name);
                }}
              >
                <button
                  type="button"
                  className={headerButton}
                  onClick={(e) => onColumnMenu(c, e.currentTarget)}
                  title={`${c.name} · ${KIND_LABELS[c.kind]}`}
                >
                  <ColumnIcon kind={c.kind} />
                  <span className="truncate">{c.name}</span>
                  {sortMark(c.name)}
                </button>
                <span onPointerDown={(e) => startResize(c.name, e)} className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-violet-400/50" />
              </th>
            ))}
            <th
              className="p-0"
              onDragOver={(e) => e.dataTransfer.types.includes(COLUMN_DRAG) && e.preventDefault()}
              onDrop={(e) => {
                const name = e.dataTransfer.getData(COLUMN_DRAG);
                if (name) onReorder(name, null);
              }}
            >
              <button type="button" onClick={onAddColumn} className={`${headerButton} justify-center`} aria-label="Nueva propiedad" title="Nueva propiedad">
                <Plus className="size-4" />
              </button>
            </th>
          </tr>
        </thead>
        {groups.map((g) => {
          const key = g.key ?? "\u0000vacío";
          const closed = collapsed.has(key);
          return (
            <tbody key={key}>
              {groupColumn && (
                <tr>
                  <td colSpan={columns.length + 2} className="pt-4 pb-1">
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsed((s) => {
                          const n = new Set(s);
                          if (n.has(key)) n.delete(key);
                          else n.add(key);
                          return n;
                        })
                      }
                      className="flex items-center gap-1.5 rounded-md px-1 py-0.5 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <ChevronRight className={`size-3.5 text-neutral-400 transition-transform ${closed ? "" : "rotate-90"}`} />
                      {g.key ?? <span className="text-neutral-400">Sin {groupColumn.name}</span>}
                      <span className="text-xs font-normal text-neutral-400">{g.rows.length}</span>
                    </button>
                  </td>
                </tr>
              )}
              {!closed &&
                g.rows.map((row) => (
                  <TableRow
                    key={row.path}
                    row={row}
                    columns={columns}
                    ctx={ctx}
                    options={options}
                    onOpenNote={onOpenNote}
                    onPeek={onPeek}
                    onChangeValue={onChangeValue}
                    onOpenLink={onOpenLink}
                  />
                ))}
              {!closed && (
                <tr>
                  <td colSpan={columns.length + 2}>
                    <button
                      type="button"
                      onClick={() => onNewRow(presetFor(g))}
                      className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-sm text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
                    >
                      <Plus className="size-4" /> Nueva
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          );
        })}
        <tfoot>
          <tr className="border-t border-neutral-200 dark:border-neutral-800">
            <td className="px-2 py-1.5 text-xs text-neutral-400">
              {rows.length} {rows.length === 1 ? "nota" : "notas"}
            </td>
            {columns.map((c) => {
              const fn = view.totals[c.name];
              return (
                <td key={c.name} className="group/total p-0">
                  <button
                    type="button"
                    onClick={(e) => setTotalMenu({ column: c, anchor: e.currentTarget })}
                    className="flex w-full items-center justify-end gap-1 truncate px-2 py-1.5 text-xs text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {fn ? (
                      <>
                        <span className="truncate">{TOTALS[fn]}</span>
                        <span className="font-medium text-neutral-700 tabular-nums dark:text-neutral-200">
                          {total(fn, rows.map((r) => cell(r, c, ctx).value))}
                        </span>
                      </>
                    ) : (
                      <span className="opacity-0 group-hover/total:opacity-100">Calcular</span>
                    )}
                  </button>
                </td>
              );
            })}
            <td />
          </tr>
        </tfoot>
      </table>

      {totalMenu && (
        <Popover anchor={totalMenu.anchor} onClose={() => setTotalMenu(null)} className="max-h-80 w-48 overflow-y-auto p-1">
          <PopoverItem
            active={!view.totals[totalMenu.column.name]}
            onClick={() => {
              const next = { ...view.totals };
              delete next[totalMenu.column.name];
              setTotalMenu(null);
              onUpdateView({ totals: next });
            }}
          >
            Ninguno
          </PopoverItem>
          {totalsFor(totalMenu.column.kind).map((fn) => (
            <PopoverItem
              key={fn}
              active={view.totals[totalMenu.column.name] === fn}
              onClick={() => {
                setTotalMenu(null);
                onUpdateView({ totals: { ...view.totals, [totalMenu.column.name]: fn } });
              }}
            >
              {TOTALS[fn]}
            </PopoverItem>
          ))}
        </Popover>
      )}
    </div>
  );
}

function TableRow({
  row,
  columns,
  ctx,
  options,
  onOpenNote,
  onPeek,
  onChangeValue,
  onOpenLink,
}: {
  row: Row;
  columns: Column[];
  ctx: ViewProps["ctx"];
  options: Record<string, string[]>;
  onOpenNote: (path: string) => void;
  onPeek: (path: string) => void;
  onChangeValue: (rowPath: string, column: string, value: PropValue) => void;
  onOpenLink: (target: string) => void;
}) {
  const icon = row.props.icono;
  return (
    <tr className="group/row border-b border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900">
      <td className="border-r border-neutral-200 p-0 dark:border-neutral-800">
        <div className="flex items-center pr-1">
          <button
            type="button"
            onClick={() => onPeek(row.path)}
            className="min-w-0 flex-1 truncate px-2 py-1.5 text-left font-medium hover:underline"
            title={row.error ?? `Abrir ${row.name}`}
          >
            {row.error && <span className="mr-1 text-red-500">⚠</span>}
            {typeof icon === "string" && <span className="mr-1.5">{icon}</span>}
            {row.subfolder && <span className="mr-1 font-normal text-neutral-400">{row.subfolder}/</span>}
            {row.name}
          </button>
          <button
            type="button"
            onClick={() => onOpenNote(row.path)}
            className="flex shrink-0 items-center gap-1 rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[11px] text-neutral-500 opacity-0 group-hover/row:opacity-100 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800"
            title="Abrir como página"
          >
            <Maximize2 className="size-3" /> Abrir
          </button>
        </div>
      </td>
      {columns.map((c) => {
        const computed = COMPUTED_KINDS.has(c.kind);
        const value = computed ? cell(row, c, ctx) : null;
        return (
          <td key={c.name} className="overflow-hidden border-r border-neutral-200 p-0.5 dark:border-neutral-800">
            {row.error ? null : computed ? (
              <CellView kind={c.kind} value={value!.value} error={value!.error} onOpenLink={onOpenLink} />
            ) : (
              <PropertyInput
                id={`${row.path}-${c.name}`}
                kind={c.kind}
                value={row.props[c.name]}
                options={options[c.name]}
                notePath={row.path}
                relation={c.relation}
                onOpenLink={onOpenLink}
                onChange={(v) => onChangeValue(row.path, c.name, v)}
              />
            )}
          </td>
        );
      })}
      <td />
    </tr>
  );
}
