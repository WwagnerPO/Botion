import {
  CalendarDays,
  KanbanSquare,
  Plus,
  Search,
  Table2,
  Type,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { COVER_KEY, ICON_KEY } from "../lib/cover";
import {
  KIND_LABELS,
  columnOptions,
  compareValues,
  deleteDatabaseProperty,
  getDatabase,
  renameDatabaseProperty,
  saveDatabaseConfig,
  setProperty,
  valueText,
  type Column,
  type Config,
  type Database,
  type Kind,
  type PropValue,
  type Props as PropMap,
  type View,
} from "../lib/database";
import { BoardView } from "./BoardView";
import { CalendarView } from "./CalendarView";
import type { MenuItem } from "./ContextMenu";
import type { DialogRequest } from "./Dialog";
import { KIND_ICONS } from "./kindIcons";
import { PropertyInput } from "./PropertyInput";

interface Props {
  path: string;
  /** Cambia cuando algo de fuera puede haber modificado las notas. */
  reloadKey: number;
  onOpenNote: (path: string) => void;
  /** Nueva nota en la base de datos, con propiedades ya puestas. */
  onNewRow: (folder: string, preset?: PropMap) => void;
  onError: (message: string) => void;
  showMenu: (x: number, y: number, items: MenuItem[]) => void;
  showDialog: (request: DialogRequest) => void;
}

const KINDS = Object.keys(KIND_LABELS) as Kind[];

const VIEWS = [
  { value: "table", label: "Tabla", Icon: Table2 },
  { value: "board", label: "Kanban", Icon: KanbanSquare },
  { value: "calendar", label: "Calendario", Icon: CalendarDays },
] as const satisfies readonly { value: View; label: string; Icon: unknown }[];

/** Propiedades de la cabecera de la nota: no son columnas. */
const PAGE_KEYS = new Set([ICON_KEY, COVER_KEY]);

function configOf(db: Database): Config {
  return {
    columns: db.columns,
    sort: db.sort,
    view: db.view,
    group_by: db.group_by,
    date_by: db.date_by,
    subfolders: db.subfolders,
  };
}

export function DatabaseView({
  path,
  reloadKey,
  onOpenNote,
  onNewRow,
  onError,
  showMenu,
  showDialog,
}: Props) {
  const [db, setDb] = useState<Database | null>(null);
  const [filter, setFilter] = useState("");

  const reload = useCallback(async () => {
    try {
      const loaded = await getDatabase(path);
      setDb({ ...loaded, columns: loaded.columns.filter((c) => !PAGE_KEYS.has(c.name)) });
    } catch (e) {
      onError(String(e));
    }
  }, [path, onError]);

  useEffect(() => {
    reload();
  }, [reload, reloadKey]);

  // Al volver a la ventana, por si se han editado notas desde fuera.
  useEffect(() => {
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [reload]);

  const rows = useMemo(() => {
    if (!db) return [];
    const q = filter.trim().toLowerCase();
    let result = q
      ? db.rows.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            Object.values(r.props).some((v) =>
              valueText(v).toLowerCase().includes(q),
            ),
        )
      : db.rows;
    const sort = db.sort;
    if (sort) {
      result = [...result].sort((a, b) =>
        sort.column === ""
          ? compareValues(a.name, b.name, sort.desc)
          : compareValues(
              a.props[sort.column],
              b.props[sort.column],
              sort.desc,
            ),
      );
    }
    return result;
  }, [db, filter]);

  if (!db) return null;
  const database = db;

  const options = columnOptions(database);

  async function saveConfig(patch: Partial<Config>) {
    const next = { ...database, ...patch };
    setDb(next);
    try {
      await saveDatabaseConfig(database.path, configOf(next));
      // Cambiar las subcarpetas cambia qué filas hay.
      if ("subfolders" in patch) await reload();
    } catch (e) {
      onError(String(e));
    }
  }

  async function changeValue(
    rowPath: string,
    column: string,
    value: PropValue,
  ) {
    // Se ve el cambio al momento; si falla, se recarga lo que hay en disco.
    setDb({
      ...database,
      rows: database.rows.map((r) =>
        r.path === rowPath
          ? { ...r, props: { ...r.props, [column]: value } }
          : r,
      ),
    });
    try {
      await setProperty(rowPath, column, value);
    } catch (e) {
      onError(String(e));
      reload();
    }
  }

  function addColumn() {
    showDialog({
      kind: "prompt",
      title: "Nueva propiedad",
      label: "Nombre",
      initial: "",
      confirm: "Añadir",
      onConfirm: (name) => {
        if (database.columns.some((c) => c.name === name)) {
          onError(`Ya existe la propiedad «${name}»`);
          return;
        }
        return saveConfig({
          columns: [...database.columns, { name, kind: "text" }],
        });
      },
    });
  }

  function columnMenu(column: Column | null, e: React.MouseEvent) {
    const name = column?.name ?? "";
    const sortBy = (desc: boolean) => () =>
      saveConfig({ sort: { column: name, desc } });
    const items: MenuItem[] = [
      { label: "Orden ascendente", onSelect: sortBy(false) },
      { label: "Orden descendente", onSelect: sortBy(true) },
    ];
    if (database.sort) {
      items.push({
        label: "Quitar orden",
        onSelect: () => saveConfig({ sort: null }),
      });
    }
    if (column) {
      items.push(
        ...KINDS.map((kind) => ({
          label: `${kind === column.kind ? "✓ " : ""}Tipo: ${KIND_LABELS[kind]}`,
          onSelect: () =>
            saveConfig({
              columns: database.columns.map((c) =>
                c.name === column.name ? { ...c, kind } : c,
              ),
            }),
        })),
        {
          label: "Renombrar",
          onSelect: () =>
            showDialog({
              kind: "prompt",
              title: "Renombrar propiedad",
              label: "Nuevo nombre",
              initial: column.name,
              confirm: "Renombrar",
              onConfirm: async (newName) => {
                try {
                  // La columna puede no estar guardada aún (deducida de las notas).
                  await saveDatabaseConfig(database.path, configOf(database));
                  await renameDatabaseProperty(
                    database.path,
                    column.name,
                    newName,
                  );
                } catch (err) {
                  onError(String(err));
                }
                await reload();
              },
            }),
        },
        {
          label: "Eliminar",
          danger: true,
          onSelect: () =>
            showDialog({
              kind: "confirm",
              title: "Eliminar propiedad",
              message: `Se quitará «${column.name}» de todas las notas de «${database.name}».`,
              confirm: "Eliminar",
              danger: true,
              onConfirm: async () => {
                try {
                  await deleteDatabaseProperty(database.path, column.name);
                } catch (err) {
                  onError(String(err));
                }
                await reload();
              },
            }),
        },
      );
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    showMenu(rect.left, rect.bottom + 4, items);
  }

  function sortMark(column: string) {
    if (database.sort?.column !== column) return null;
    return (
      <span className="text-neutral-400">
        {database.sort.desc ? " ↓" : " ↑"}
      </span>
    );
  }

  const headerButton =
    "flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[13px] font-normal text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800";

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-10 pt-10 pb-24">
        <p className="mb-2 text-xs text-neutral-400">{database.path}</p>
        <h1 className="mb-5 flex items-center gap-3 text-[2.1rem] font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
          <span className="grid size-10 place-items-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300">
            <Table2 className="size-6" strokeWidth={1.75} />
          </span>
          {database.name}
        </h1>

        <div
          role="tablist"
          aria-label="Vista"
          className="mb-4 flex gap-1 border-b border-neutral-200 dark:border-neutral-800"
        >
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              role="tab"
              aria-selected={database.view === v.value}
              onClick={() => saveConfig({ view: v.value })}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-sm ${
                database.view === v.value
                  ? "border-neutral-800 font-medium text-neutral-900 dark:border-neutral-200 dark:text-neutral-50"
                  : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              <v.Icon className="size-4" />
              {v.label}
            </button>
          ))}
        </div>

        <div className="mb-3 flex items-center gap-2">
          <label className="flex w-56 items-center gap-2 rounded-md border border-neutral-200 px-2 py-1 text-sm focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-400/20 dark:border-neutral-700">
            <Search className="size-3.5 shrink-0 text-neutral-400" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar…"
              className="w-full bg-transparent outline-none placeholder:text-neutral-400"
            />
          </label>
          <span className="text-xs text-neutral-400">
            {rows.length} de {database.rows.length}
          </span>
          <label className="flex items-center gap-1.5 text-xs text-neutral-500">
            <input
              type="checkbox"
              checked={database.subfolders}
              onChange={(e) => saveConfig({ subfolders: e.target.checked })}
              className="accent-violet-600"
            />
            Incluir subcarpetas
          </label>
          <button
            type="button"
            onClick={() => onNewRow(database.path)}
            className="ml-auto flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
          >
            <Plus className="size-4" />
            Nueva
          </button>
        </div>

        {database.view === "board" && (
          <BoardView
            db={database}
            rows={rows}
            options={options}
            onOpenNote={onOpenNote}
            onChangeValue={changeValue}
            onNewRow={(preset) => onNewRow(database.path, preset)}
            onGroupBy={(group_by) => saveConfig({ group_by })}
          />
        )}
        {database.view === "calendar" && (
          <CalendarView
            db={database}
            rows={rows}
            onOpenNote={onOpenNote}
            onChangeValue={changeValue}
            onNewRow={(preset) => onNewRow(database.path, preset)}
            onDateBy={(date_by) => saveConfig({ date_by })}
          />
        )}
        {database.view === "table" && (
          <table className="w-max min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-neutral-200 dark:border-neutral-800">
                <th className="w-56 min-w-56 border-r border-neutral-200 p-0 dark:border-neutral-800">
                  <button
                    type="button"
                    className={headerButton}
                    onClick={(e) => columnMenu(null, e)}
                  >
                    <Type className="size-3.5 shrink-0 text-neutral-400" />
                    Nombre{sortMark("")}
                  </button>
                </th>
                {database.columns.map((c) => (
                  <th
                    key={c.name}
                    className="min-w-40 border-r border-neutral-200 p-0 dark:border-neutral-800"
                  >
                    <button
                      type="button"
                      className={headerButton}
                      onClick={(e) => columnMenu(c, e)}
                      title={KIND_LABELS[c.kind]}
                    >
                      {(() => {
                        const Icon = KIND_ICONS[c.kind];
                        return <Icon className="size-3.5 shrink-0 text-neutral-400" />;
                      })()}
                      <span className="truncate">{c.name}</span>
                      {sortMark(c.name)}
                    </button>
                  </th>
                ))}
                <th className="p-0">
                  <button
                    type="button"
                    onClick={addColumn}
                    className={`${headerButton} text-neutral-400`}
                    aria-label="Nueva propiedad"
                    title="Nueva propiedad"
                  >
                    <Plus className="size-4" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.path}
                  className="group border-b border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                >
                  <td className="border-r border-neutral-200 p-0 dark:border-neutral-800">
                    <button
                      type="button"
                      onClick={() => onOpenNote(row.path)}
                      className="w-full truncate px-2 py-1.5 text-left font-medium hover:underline"
                      title={row.error ?? `Abrir ${row.name}`}
                    >
                      {row.error && (
                        <span className="mr-1 text-red-500">⚠</span>
                      )}
                      {typeof row.props[ICON_KEY] === "string" && (
                        <span className="mr-1.5">{row.props[ICON_KEY] as string}</span>
                      )}
                      {row.subfolder && (
                        <span className="mr-1 font-normal text-neutral-400">
                          {row.subfolder}/
                        </span>
                      )}
                      {row.name}
                    </button>
                  </td>
                  {database.columns.map((c) => (
                    <td
                      key={c.name}
                      className="border-r border-neutral-200 p-0.5 dark:border-neutral-800"
                    >
                      {row.error ? null : (
                        <PropertyInput
                          id={`${row.path}-${c.name}`}
                          kind={c.kind}
                          value={row.props[c.name]}
                          options={options[c.name]}
                          onChange={(v) => changeValue(row.path, c.name, v)}
                        />
                      )}
                    </td>
                  ))}
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {database.rows.length === 0 && (
          <p className="mt-4 text-sm text-neutral-400">
            Aún no hay notas. Pulsa «Nueva» para crear la primera fila.
          </p>
        )}
      </div>
    </div>
  );
}
