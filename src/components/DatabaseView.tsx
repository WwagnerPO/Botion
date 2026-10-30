import { ChevronDown, FileText, Pencil, Plus, Search, Table2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PAGE_KEYS } from "../lib/cover";
import {
  activeView,
  columnOptions,
  configOf,
  createDbTemplate,
  deleteDatabaseProperty,
  getDatabase,
  newView,
  renameDatabaseProperty,
  saveDatabaseConfig,
  setProperty,
  valueText,
  type Column,
  type Config,
  type Database,
  type Filter,
  type PropValue,
  type Props as PropMap,
  type ViewConfig,
} from "../lib/database";
import { rowTint, viewRows, type Ctx, type Related } from "../lib/dbview";
import { formatDate } from "../lib/naturalDate";
import { nextDate } from "../lib/recurrence";
import { ChartView } from "./ChartView";
import { Popover, PopoverItem } from "./Popover";
import { BoardView } from "./BoardView";
import { CalendarView } from "./CalendarView";
import { GalleryView, ListView } from "./CardViews";
import { ColumnMenu } from "./ColumnMenu";
import type { DialogRequest } from "./Dialog";
import { PeekPanel } from "./PeekPanel";
import { TableView } from "./TableView";
import { TimelineView } from "./TimelineView";
import { FilterBar, ViewTabs, ViewToolbar } from "./ViewControls";
import type { ViewProps } from "./viewProps";

interface Props {
  path: string;
  /** Cambia cuando algo de fuera puede haber modificado las notas. */
  reloadKey: number;
  onOpenNote: (path: string) => void;
  /** Abre el destino de un enlace `[[…]]`. */
  onOpenLink: (target: string) => void;
  /** Nueva nota en la base de datos, con propiedades ya puestas o desde una plantilla. */
  onNewRow: (folder: string, preset?: PropMap, template?: string) => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  showDialog: (request: DialogRequest) => void;
  /** Bases de datos de la bóveda, para las relaciones. */
  databases: { path: string; name: string }[];
  vaultRoot: string;
}

export function DatabaseView({
  path,
  reloadKey,
  onOpenNote,
  onOpenLink,
  onNewRow,
  onError,
  onNotice,
  showDialog,
  databases,
  vaultRoot,
}: Props) {
  const [newMenu, setNewMenu] = useState<HTMLElement | null>(null);
  const [db, setDb] = useState<Database | null>(null);
  const [related, setRelated] = useState<Related>({});
  const [search, setSearch] = useState("");
  const [peek, setPeek] = useState<string | null>(null);
  const [columnMenu, setColumnMenu] = useState<{ column: Column | null; anchor: HTMLElement } | null>(null);
  const [newFilter, setNewFilter] = useState<number | null>(null);

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

  // Bases de datos de las relaciones, para los rollups.
  const targets = useMemo(
    () => [...new Set((db?.columns ?? []).map((c) => c.relation).filter((t): t is string => !!t))].sort().join("\n"),
    [db?.columns],
  );
  useEffect(() => {
    let current = true;
    const list = targets ? targets.split("\n") : [];
    Promise.all(list.map((t) => getDatabase(t).then((d) => [t, d] as const).catch(() => [t, undefined] as const))).then(
      (pairs) => current && setRelated(Object.fromEntries(pairs)),
    );
    return () => {
      current = false;
    };
  }, [targets, reloadKey]);

  const ctx: Ctx | null = useMemo(() => (db ? { db, related } : null), [db, related]);
  const view = db ? activeView(db) : null;
  const rows = useMemo(() => (view && ctx ? viewRows(view, ctx, search) : []), [view, ctx, search]);

  if (!db || !view || !ctx) return null;
  const database = db;
  const options = columnOptions(database);
  const columns = database.columns.filter((c) => !view.hidden.includes(c.name));

  async function saveConfig(next: Config, reloadAfter = false) {
    setDb({ ...database, ...next });
    try {
      await saveDatabaseConfig(database.path, configOf({ ...database, ...next }));
      if (reloadAfter) await reload();
    } catch (e) {
      onError(String(e));
    }
  }

  const updateView = (id: string, patch: Partial<ViewConfig>) =>
    saveConfig({ ...database, views: database.views.map((v) => (v.id === id ? { ...v, ...patch } : v)) });
  const updateCurrent = (patch: Partial<ViewConfig>) => updateView(view.id, patch);

  /**
   * Cambia un valor. Si marca como hecha una tarea que se repite, en lugar
   * de eso avanza su fecha y la deja pendiente otra vez.
   */
  async function changeValue(rowPath: string, column: string, value: PropValue) {
    const rec = database.recurrence;
    const doneColumn = rec && database.columns.find((c) => c.name === rec.done);
    if (rec && doneColumn && column === rec.done) {
      const checkbox = doneColumn.kind === "checkbox";
      const done = checkbox
        ? value === true
        : valueText(value).trim().toLowerCase() === (rec.done_value ?? "Hecho").toLowerCase();
      const row = database.rows.find((r) => r.path === rowPath);
      const rule = row ? valueText(row.props[rec.repeat]).trim() : "";
      const date = row ? valueText(row.props[rec.date]) : "";
      const next = done && rule && /^\d{4}-\d{2}-\d{2}/.test(date) ? nextDate(date.slice(0, 10), rule) : null;
      if (row && next) {
        await setValue(rowPath, rec.date, next + date.slice(10));
        await setValue(rowPath, rec.done, checkbox ? false : (rec.todo_value || null));
        onNotice(`«${row.name}» se repite ${rule}: la próxima es el ${formatDate(next)}.`);
        return;
      }
    }
    await setValue(rowPath, column, value);
  }

  async function setValue(rowPath: string, column: string, value: PropValue) {
    // Se ve el cambio al momento; si falla, se recarga lo que hay en disco.
    // Sobre el estado más reciente: puede haber varios cambios seguidos.
    setDb((prev) =>
      prev && {
        ...prev,
        rows: prev.rows.map((r) => (r.path === rowPath ? { ...r, props: { ...r.props, [column]: value } } : r)),
      },
    );
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
        if (database.columns.some((c) => c.name === name) || PAGE_KEYS.has(name)) {
          onError(`Ya existe la propiedad «${name}»`);
          return;
        }
        return saveConfig({ ...database, columns: [...database.columns, { name, kind: "text" }] });
      },
    });
  }

  function addFilter(column: string) {
    const filters: Filter[] = [...view!.filters, { column, op: "contains", value: "" }];
    setNewFilter(filters.length - 1);
    updateCurrent({ filters });
  }

  async function renameColumn(column: Column, newName: string) {
    try {
      // La columna puede no estar guardada aún (deducida de las notas).
      await saveDatabaseConfig(database.path, configOf(database));
      await renameDatabaseProperty(database.path, column.name, newName);
    } catch (err) {
      onError(String(err));
    }
    await reload();
  }

  function deleteColumn(column: Column) {
    showDialog({
      kind: "confirm",
      title: "Eliminar propiedad",
      message: `Se quitará «${column.name}» de todas las notas de «${database.name}».`,
      confirm: "Eliminar",
      danger: true,
      onConfirm: async () => {
        try {
          await saveDatabaseConfig(database.path, configOf(database));
          await deleteDatabaseProperty(database.path, column.name);
        } catch (err) {
          onError(String(err));
        }
        await reload();
      },
    });
  }

  function reorder(name: string, before: string | null) {
    const moving = database.columns.find((c) => c.name === name);
    if (!moving) return;
    const rest = database.columns.filter((c) => c.name !== name);
    const at = before === null ? rest.length : rest.findIndex((c) => c.name === before);
    rest.splice(at < 0 ? rest.length : at, 0, moving);
    saveConfig({ ...database, columns: rest });
  }

  const props: ViewProps = {
    db: database,
    view,
    rows,
    ctx,
    columns,
    options,
    vaultRoot,
    onOpenNote,
    onOpenLink,
    onPeek: setPeek,
    onChangeValue: changeValue,
    onNewRow: (preset) => onNewRow(database.path, preset),
    onUpdateView: updateCurrent,
    tintOf: (row) => rowTint(row, view.colors, ctx),
  };
  const peekRow = peek ? database.rows.find((r) => r.path === peek) : undefined;

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

        <ViewTabs
          db={database}
          active={view}
          onActivate={(id) => saveConfig({ ...database, active_view: id })}
          onAdd={(kind) => {
            const v = newView(kind);
            saveConfig({ ...database, views: [...database.views, v], active_view: v.id });
          }}
          onUpdate={updateView}
          onDuplicate={(id) => {
            const src = database.views.find((v) => v.id === id)!;
            const copy = { ...structuredClone(src), id: newView(src.kind).id, name: `${src.name} (copia)` };
            saveConfig({ ...database, views: [...database.views, copy], active_view: copy.id });
          }}
          onDelete={(id) => {
            const views = database.views.filter((v) => v.id !== id);
            saveConfig({ ...database, views, active_view: views[0].id });
          }}
        />

        <div className="mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <ViewToolbar
              db={database}
              view={view}
              onUpdate={updateCurrent}
              onAddFilter={addFilter}
              onSubfolders={(subfolders) => saveConfig({ ...database, subfolders }, true)}
              onRecurrence={(recurrence) => saveConfig({ ...database, recurrence })}
            />
            <label className="ml-auto flex w-48 items-center gap-2 rounded-md border border-neutral-200 px-2 py-1 text-sm focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-400/20 dark:border-neutral-700">
              <Search className="size-3.5 shrink-0 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar…"
                aria-label="Buscar en la base de datos"
                className="w-full bg-transparent outline-none placeholder:text-neutral-400"
              />
            </label>
            <span className="text-xs text-neutral-400">
              {rows.length} de {database.rows.length}
            </span>
            <span className="flex rounded-md bg-violet-600 text-sm font-medium text-white shadow-sm">
              <button
                type="button"
                onClick={() => onNewRow(database.path)}
                className="flex items-center gap-1 rounded-l-md py-1 pr-2 pl-2.5 hover:bg-violet-700"
              >
                <Plus className="size-4" />
                Nueva
              </button>
              <button
                type="button"
                onClick={(e) => setNewMenu(e.currentTarget)}
                aria-label="Nueva desde plantilla"
                title="Plantillas"
                className="rounded-r-md border-l border-violet-500 px-1.5 hover:bg-violet-700"
              >
                <ChevronDown className="size-4" />
              </button>
            </span>
          </div>
          <FilterBar
            db={database}
            view={view}
            options={options}
            onChange={(filters) => updateCurrent({ filters })}
            openIndex={newFilter}
            onOpened={() => setNewFilter(null)}
          />
        </div>

        {view.kind === "table" && (
          <TableView
            {...props}
            onColumnMenu={(column, anchor) => setColumnMenu({ column, anchor })}
            onAddColumn={addColumn}
            onReorder={reorder}
          />
        )}
        {view.kind === "board" && <BoardView {...props} />}
        {view.kind === "calendar" && <CalendarView {...props} />}
        {view.kind === "gallery" && <GalleryView {...props} />}
        {view.kind === "list" && <ListView {...props} />}
        {view.kind === "timeline" && <TimelineView {...props} />}
        {view.kind === "chart" && <ChartView {...props} />}

        {database.rows.length === 0 && (
          <p className="mt-4 text-sm text-neutral-400">Aún no hay notas. Pulsa «Nueva» para crear la primera fila.</p>
        )}
        {database.rows.length > 0 && rows.length === 0 && (
          <p className="mt-4 text-sm text-neutral-400">Ninguna nota cumple los filtros de esta vista.</p>
        )}
      </div>

      {columnMenu && (
        <ColumnMenu
          anchor={columnMenu.anchor}
          column={columnMenu.column}
          db={database}
          related={related}
          databases={databases}
          onClose={() => setColumnMenu(null)}
          onRename={(name) => columnMenu.column && renameColumn(columnMenu.column, name)}
          onChange={(column) => {
            setColumnMenu((m) => (m ? { ...m, column } : m));
            saveConfig({ ...database, columns: database.columns.map((c) => (c.name === column.name ? column : c)) });
          }}
          onSort={(desc) => updateCurrent({ sort: { column: columnMenu.column?.name ?? "", desc } })}
          onFilter={() => addFilter(columnMenu.column?.name ?? "")}
          onHide={() => columnMenu.column && updateCurrent({ hidden: [...view.hidden, columnMenu.column.name] })}
          onDelete={() => columnMenu.column && deleteColumn(columnMenu.column)}
        />
      )}

      {newMenu && (
        <Popover anchor={newMenu} onClose={() => setNewMenu(null)} alignRight className="w-64 p-1">
          <p className="px-2 pt-1 pb-1 text-xs text-neutral-400">Plantillas de «{database.name}»</p>
          {database.templates.length === 0 && (
            <p className="px-2 pb-1 text-xs text-neutral-400">Aún no hay. Una plantilla es una nota con el texto y las propiedades de partida.</p>
          )}
          {database.templates.map((t) => (
            <div key={t.path} className="group flex items-center">
              <PopoverItem onClick={() => (setNewMenu(null), onNewRow(database.path, {}, t.path))}>
                <FileText className="size-4 text-neutral-400" /> {t.name}
              </PopoverItem>
              <button
                type="button"
                onClick={() => (setNewMenu(null), onOpenNote(t.path))}
                aria-label={`Editar plantilla ${t.name}`}
                title="Editar plantilla"
                className="mr-1 rounded-md p-1.5 text-neutral-400 opacity-0 group-hover:opacity-100 hover:bg-neutral-100 hover:text-neutral-700 focus:opacity-100 dark:hover:bg-neutral-700"
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
          ))}
          <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />
          <PopoverItem
            onClick={() => {
              setNewMenu(null);
              showDialog({
                kind: "prompt",
                title: "Nueva plantilla",
                label: "Nombre",
                initial: "Plantilla",
                confirm: "Crear",
                onConfirm: async (name) => {
                  try {
                    const path = await createDbTemplate(database.path, name);
                    onOpenNote(path);
                  } catch (e) {
                    onError(String(e));
                  }
                },
              });
            }}
          >
            <Plus className="size-4 text-neutral-400" /> Nueva plantilla
          </PopoverItem>
        </Popover>
      )}

      {peekRow && (
        <PeekPanel
          row={peekRow}
          ctx={ctx}
          options={options}
          onClose={() => setPeek(null)}
          onOpenNote={onOpenNote}
          onOpenLink={onOpenLink}
          onChangeValue={changeValue}
        />
      )}
    </div>
  );
}
