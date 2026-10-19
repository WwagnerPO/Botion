import {
  ArrowUpDown,
  CalendarDays,
  ChartGantt,
  Copy,
  Eye,
  EyeOff,
  Filter as FilterIcon,
  GalleryVerticalEnd,
  KanbanSquare,
  LayoutList,
  Plus,
  Rows3,
  Settings2,
  Table2,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import {
  VIEW_LABELS,
  type Column,
  type Database,
  type Filter,
  type View,
  type ViewConfig,
} from "../lib/database";
import { operatorsFor } from "../lib/dbview";
import { ColumnIcon } from "./ColumnMenu";
import { Popover, PopoverItem } from "./Popover";

export const VIEW_ICONS: Record<View, LucideIcon> = {
  table: Table2,
  board: KanbanSquare,
  calendar: CalendarDays,
  gallery: GalleryVerticalEnd,
  list: LayoutList,
  timeline: ChartGantt,
};

const VIEWS = Object.keys(VIEW_LABELS) as View[];

const selectClass =
  "rounded-md border border-neutral-200 bg-transparent px-1.5 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900";

// ---------------------------------------------------------------------------
// Pestañas de vistas

export function ViewTabs({
  db,
  active,
  onActivate,
  onAdd,
  onUpdate,
  onDuplicate,
  onDelete,
}: {
  db: Database;
  active: ViewConfig;
  onActivate: (id: string) => void;
  onAdd: (kind: View) => void;
  onUpdate: (id: string, patch: Partial<ViewConfig>) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [menu, setMenu] = useState<{ anchor: HTMLElement; id: string } | null>(null);
  const [adding, setAdding] = useState<HTMLElement | null>(null);
  const editing = db.views.find((v) => v.id === menu?.id);

  return (
    <div role="tablist" aria-label="Vistas" className="mb-3 flex items-center gap-0.5 border-b border-neutral-200 dark:border-neutral-800">
      {db.views.map((v) => {
        const Icon = VIEW_ICONS[v.kind];
        const on = v.id === active.id;
        return (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={(e) => (on ? setMenu({ anchor: e.currentTarget, id: v.id }) : onActivate(v.id))}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ anchor: e.currentTarget, id: v.id });
            }}
            title={on ? "Opciones de la vista" : v.name}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-sm ${
              on
                ? "border-neutral-800 font-medium text-neutral-900 dark:border-neutral-200 dark:text-neutral-50"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            <Icon className="size-4" />
            {v.name}
          </button>
        );
      })}
      <button
        type="button"
        onClick={(e) => setAdding(e.currentTarget)}
        aria-label="Nueva vista"
        title="Nueva vista"
        className="ml-1 grid size-7 place-items-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
      >
        <Plus className="size-4" />
      </button>

      {adding && (
        <Popover anchor={adding} onClose={() => setAdding(null)} className="w-48 p-1">
          <p className="px-2 pt-1 pb-1.5 text-xs text-neutral-400">Nueva vista</p>
          {VIEWS.map((k) => {
            const Icon = VIEW_ICONS[k];
            return (
              <PopoverItem key={k} onClick={() => (setAdding(null), onAdd(k))}>
                <Icon className="size-4 text-neutral-400" /> {VIEW_LABELS[k]}
              </PopoverItem>
            );
          })}
        </Popover>
      )}

      {menu && editing && (
        <Popover anchor={menu.anchor} onClose={() => setMenu(null)} className="w-60 p-1.5">
          <input
            autoFocus
            defaultValue={editing.name}
            aria-label="Nombre de la vista"
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            onBlur={(e) => {
              const name = e.target.value.trim();
              if (name && name !== editing.name) onUpdate(editing.id, { name });
            }}
            className="mb-2 w-full rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 outline-none focus:border-violet-400 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <p className="px-1 pb-1 text-xs text-neutral-400">Tipo</p>
          <div className="mb-1 grid grid-cols-3 gap-1">
            {VIEWS.map((k) => {
              const Icon = VIEW_ICONS[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onUpdate(editing.id, { kind: k })}
                  className={`flex flex-col items-center gap-1 rounded-md p-1.5 text-[11px] ${
                    editing.kind === k
                      ? "bg-violet-50 text-violet-700 ring-1 ring-violet-300 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-800"
                      : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700/70"
                  }`}
                >
                  <Icon className="size-4" />
                  {VIEW_LABELS[k]}
                </button>
              );
            })}
          </div>
          <div className="border-t border-neutral-200 pt-1 dark:border-neutral-700">
            <PopoverItem onClick={() => (setMenu(null), onDuplicate(editing.id))}>
              <Copy className="size-4 text-neutral-400" /> Duplicar vista
            </PopoverItem>
            {db.views.length > 1 && (
              <PopoverItem danger onClick={() => (setMenu(null), onDelete(editing.id))}>
                <Trash2 className="size-4" /> Eliminar vista
              </PopoverItem>
            )}
          </div>
        </Popover>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barra de herramientas

const toolButton = (on: boolean) =>
  `flex items-center gap-1.5 rounded-md px-2 py-1 text-sm ${
    on
      ? "text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950"
      : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
  }`;

type Panel = "sort" | "group" | "props" | "dates";

export function ViewToolbar({
  db,
  view,
  onUpdate,
  onAddFilter,
  onSubfolders,
}: {
  db: Database;
  view: ViewConfig;
  onUpdate: (patch: Partial<ViewConfig>) => void;
  onAddFilter: (column: string) => void;
  onSubfolders: (on: boolean) => void;
}) {
  const [panel, setPanel] = useState<{ kind: Panel; anchor: HTMLElement } | null>(null);
  const open = (kind: Panel) => (e: React.MouseEvent<HTMLElement>) => setPanel({ kind, anchor: e.currentTarget });
  const close = () => setPanel(null);
  const sortable = [{ name: "", kind: "text" } as Column, ...db.columns];
  const groupable = db.columns.filter((c) =>
    ["select", "tags", "checkbox", "text", "relation", "date", "formula", "url"].includes(c.kind),
  );
  const dates = db.columns.filter((c) => ["date", "created", "edited", "formula"].includes(c.kind));
  const usesGroups = view.kind === "table" || view.kind === "list" || view.kind === "gallery" || view.kind === "board";
  const usesDates = view.kind === "calendar" || view.kind === "timeline";
  const colName = (n: string) => (n === "" ? "Nombre" : n);

  return (
    <div className="flex flex-wrap items-center gap-0.5">
      <button type="button" className={toolButton(view.filters.length > 0)} onClick={() => onAddFilter(db.columns[0]?.name ?? "")}>
        <FilterIcon className="size-4" /> Filtro
      </button>
      <button type="button" className={toolButton(!!view.sort)} onClick={open("sort")}>
        <ArrowUpDown className="size-4" /> {view.sort ? `Orden: ${colName(view.sort.column)}` : "Ordenar"}
      </button>
      {usesGroups && (
        <button type="button" className={toolButton(!!view.group_by)} onClick={open("group")}>
          <Rows3 className="size-4" /> {view.group_by ? `Grupos: ${view.group_by}` : "Agrupar"}
        </button>
      )}
      {usesDates && (
        <button type="button" className={toolButton(false)} onClick={open("dates")}>
          <CalendarDays className="size-4" /> Fechas
        </button>
      )}
      <button type="button" className={toolButton(view.hidden.length > 0)} onClick={open("props")}>
        <Settings2 className="size-4" /> Propiedades
      </button>

      {panel?.kind === "sort" && (
        <Popover anchor={panel.anchor} onClose={close} className="w-64 space-y-2 p-2">
          <div className="flex gap-1.5">
            <select
              value={view.sort?.column ?? "\u0000"}
              onChange={(e) =>
                onUpdate({ sort: e.target.value === "\u0000" ? null : { column: e.target.value, desc: view.sort?.desc ?? false } })
              }
              className={`${selectClass} min-w-0 flex-1`}
              aria-label="Ordenar por"
            >
              <option value={"\u0000"}>Sin orden</option>
              {sortable.map((c) => (
                <option key={c.name} value={c.name}>
                  {colName(c.name)}
                </option>
              ))}
            </select>
            {view.sort && (
              <select
                value={view.sort.desc ? "desc" : "asc"}
                onChange={(e) => onUpdate({ sort: { ...view.sort!, desc: e.target.value === "desc" } })}
                className={selectClass}
                aria-label="Sentido"
              >
                <option value="asc">Ascendente</option>
                <option value="desc">Descendente</option>
              </select>
            )}
          </div>
        </Popover>
      )}

      {panel?.kind === "group" && (
        <Popover anchor={panel.anchor} onClose={close} className="w-56 p-2">
          <label className="block text-xs text-neutral-400">
            Agrupar por
            <select
              value={view.group_by ?? ""}
              onChange={(e) => onUpdate({ group_by: e.target.value || null })}
              className={`${selectClass} mt-1 w-full`}
            >
              {view.kind !== "board" && <option value="">Sin agrupar</option>}
              {groupable.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </Popover>
      )}

      {panel?.kind === "dates" && (
        <Popover anchor={panel.anchor} onClose={close} className="w-56 space-y-2 p-2">
          <label className="block text-xs text-neutral-400">
            {view.kind === "timeline" ? "Inicio" : "Fecha"}
            <select
              value={view.date_by ?? ""}
              onChange={(e) => onUpdate({ date_by: e.target.value || null })}
              className={`${selectClass} mt-1 w-full`}
            >
              <option value="">Automática</option>
              {dates.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {view.kind === "timeline" && (
            <label className="block text-xs text-neutral-400">
              Fin (opcional)
              <select
                value={view.end_by ?? ""}
                onChange={(e) => onUpdate({ end_by: e.target.value || null })}
                className={`${selectClass} mt-1 w-full`}
              >
                <option value="">Sin fin (un día)</option>
                {dates.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </Popover>
      )}

      {panel?.kind === "props" && (
        <Popover anchor={panel.anchor} onClose={close} alignRight className="w-60 p-1">
          <p className="px-2 pt-1 pb-1 text-xs text-neutral-400">Propiedades en esta vista</p>
          <div className="max-h-72 overflow-y-auto">
            {db.columns.map((c) => {
              const hidden = view.hidden.includes(c.name);
              return (
                <PopoverItem
                  key={c.name}
                  onClick={() =>
                    onUpdate({ hidden: hidden ? view.hidden.filter((h) => h !== c.name) : [...view.hidden, c.name] })
                  }
                >
                  <ColumnIcon kind={c.kind} />
                  <span className={`flex-1 truncate ${hidden ? "text-neutral-400" : ""}`}>{c.name}</span>
                  {hidden ? <EyeOff className="size-4 text-neutral-400" /> : <Eye className="size-4 text-neutral-500" />}
                </PopoverItem>
              );
            })}
          </div>
          <label className="mt-1 flex items-center gap-2 border-t border-neutral-200 px-2 pt-2 pb-1 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={db.subfolders}
              onChange={(e) => onSubfolders(e.target.checked)}
              className="accent-violet-600"
            />
            Incluir subcarpetas
          </label>
        </Popover>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filtros

export function FilterBar({
  db,
  view,
  options,
  onChange,
  openIndex,
  onOpened,
}: {
  db: Database;
  view: ViewConfig;
  options: Record<string, string[]>;
  onChange: (filters: Filter[]) => void;
  /** Filtro recién añadido, que se abre para editarlo. */
  openIndex: number | null;
  onOpened: () => void;
}) {
  const [editing, setEditing] = useState<{ index: number; anchor: HTMLElement } | null>(null);
  if (view.filters.length === 0) return null;
  const columns = [{ name: "", kind: "text" } as Column, ...db.columns];
  const kindOf = (name: string) => columns.find((c) => c.name === name)?.kind ?? "text";
  const update = (i: number, patch: Partial<Filter>) =>
    onChange(view.filters.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const current = editing ? view.filters[editing.index] : null;
  const ops = current ? operatorsFor(kindOf(current.column)) : [];
  const op = ops.find((o) => o.op === current?.op);
  const currentKind = current ? kindOf(current.column) : "text";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {view.filters.map((f, i) => {
        const o = operatorsFor(kindOf(f.column)).find((x) => x.op === f.op);
        return (
          <span key={i} className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 text-xs text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200">
            <button
              type="button"
              ref={(el) => {
                if (el && openIndex === i && !editing) {
                  setEditing({ index: i, anchor: el });
                  onOpened();
                }
              }}
              onClick={(e) => setEditing({ index: i, anchor: e.currentTarget })}
              className="py-1 pr-1 pl-2.5"
            >
              <span className="font-medium">{f.column || "Nombre"}</span> {o?.label ?? f.op}
              {!o?.unary && valueLabel(f.value) && <span className="font-medium"> {valueLabel(f.value)}</span>}
            </button>
            <button
              type="button"
              onClick={() => onChange(view.filters.filter((_, j) => j !== i))}
              aria-label="Quitar filtro"
              className="rounded-full p-1 pr-1.5 hover:text-red-500"
            >
              <X className="size-3" />
            </button>
          </span>
        );
      })}
      <button
        type="button"
        onClick={() => onChange([...view.filters, { column: db.columns[0]?.name ?? "", op: "contains", value: "" }])}
        className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        <Plus className="size-3" /> Añadir filtro
      </button>

      {editing && current && (
        <Popover anchor={editing.anchor} onClose={() => setEditing(null)} className="w-72 space-y-2 p-2">
          <div className="flex gap-1.5">
            <select
              value={current.column}
              aria-label="Propiedad"
              onChange={(e) => {
                const first = operatorsFor(kindOf(e.target.value))[0];
                update(editing.index, { column: e.target.value, op: first.op, value: "" });
              }}
              className={`${selectClass} min-w-0 flex-1`}
            >
              {columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name || "Nombre"}
                </option>
              ))}
            </select>
            <select
              value={current.op}
              aria-label="Condición"
              onChange={(e) => update(editing.index, { op: e.target.value })}
              className={`${selectClass} min-w-0 flex-1`}
            >
              {ops.map((o) => (
                <option key={o.op} value={o.op}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {!op?.unary && (
            <>
              <input
                autoFocus
                type={["date", "created", "edited"].includes(currentKind) ? "date" : currentKind === "number" ? "number" : "text"}
                value={valueLabel(current.value)}
                list={`filtro-${editing.index}`}
                aria-label="Valor"
                placeholder="Valor…"
                onChange={(e) =>
                  update(editing.index, {
                    value: currentKind === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value,
                  })
                }
                onKeyDown={(e) => e.key === "Enter" && setEditing(null)}
                className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 outline-none focus:border-violet-400 dark:border-neutral-700 dark:bg-neutral-900"
              />
              <datalist id={`filtro-${editing.index}`}>
                {(options[current.column] ?? []).map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </>
          )}
          <PopoverItem danger onClick={() => (setEditing(null), onChange(view.filters.filter((_, j) => j !== editing.index)))}>
            <Trash2 className="size-4" /> Quitar filtro
          </PopoverItem>
        </Popover>
      )}
    </div>
  );
}

const valueLabel = (v: Filter["value"]) => (v === null || v === undefined ? "" : Array.isArray(v) ? v.join(", ") : String(v));
