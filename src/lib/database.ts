import { invoke } from "@tauri-apps/api/core";

export type Kind =
  | "text"
  | "number"
  | "checkbox"
  | "date"
  | "select"
  | "tags"
  | "url"
  | "email"
  | "phone"
  | "files"
  | "relation"
  | "rollup"
  | "formula"
  | "created"
  | "edited";

/** Tipos que se calculan y no se guardan en las notas. */
export const COMPUTED_KINDS: ReadonlySet<Kind> = new Set([
  "rollup",
  "formula",
  "created",
  "edited",
]);

export interface Rollup {
  /** Columna de relación de esta base de datos. */
  relation: string;
  /** Propiedad de la base de datos relacionada. */
  property: string;
  function: string;
}

export type PropValue = string | number | boolean | string[] | null;
export type Props = Record<string, PropValue>;

export interface Column {
  name: string;
  kind: Kind;
  /** Expresión de una columna de fórmula. */
  formula?: string;
  /** Carpeta de la base de datos a la que apunta una relación. */
  relation?: string;
  rollup?: Rollup;
}

export interface Sort {
  column: string;
  desc: boolean;
}

export interface Row {
  path: string;
  name: string;
  /** Subcarpeta dentro de la base de datos (`""` si está directamente). */
  subfolder: string;
  props: Props;
  error: string | null;
  /** Creación y última modificación del fichero (milisegundos). */
  created: number | null;
  modified: number | null;
}

export type View = "table" | "board" | "calendar" | "gallery" | "list" | "timeline";

export const VIEW_LABELS: Record<View, string> = {
  table: "Tabla",
  board: "Kanban",
  calendar: "Calendario",
  gallery: "Galería",
  list: "Lista",
  timeline: "Cronograma",
};

/** Condición de un filtro: «estado es Hecho». */
export interface Filter {
  column: string;
  op: string;
  value: PropValue;
}

/** Una vista guardada de la base de datos. */
export interface ViewConfig {
  id: string;
  name: string;
  kind: View;
  filters: Filter[];
  sort: Sort | null;
  /** Agrupar (kanban, tabla, lista, galería). */
  group_by: string | null;
  /** Fecha del calendario o inicio en el cronograma. */
  date_by: string | null;
  /** Fecha de fin en el cronograma. */
  end_by: string | null;
  hidden: string[];
  widths: Record<string, number>;
  totals: Record<string, string>;
}

/** Lo que se guarda en `.botion-db.json`. */
export interface Config {
  columns: Column[];
  views: ViewConfig[];
  active_view: string | null;
  /** Incluir las notas de las subcarpetas. */
  subfolders: boolean;
}

export interface Database extends Config {
  path: string;
  name: string;
  rows: Row[];
}

export const KIND_LABELS: Record<Kind, string> = {
  text: "Texto",
  number: "Número",
  checkbox: "Casilla",
  date: "Fecha",
  select: "Selección",
  tags: "Etiquetas",
  url: "URL",
  email: "Email",
  phone: "Teléfono",
  files: "Archivos",
  relation: "Relación",
  rollup: "Rollup",
  formula: "Fórmula",
  created: "Fecha de creación",
  edited: "Última edición",
};

/** Vista nueva con los valores por defecto. */
export function newView(kind: View, name = VIEW_LABELS[kind]): ViewConfig {
  return {
    id: `vista-${Date.now().toString(36)}`,
    name,
    kind,
    filters: [],
    sort: null,
    group_by: null,
    date_by: null,
    end_by: null,
    hidden: [],
    widths: {},
    totals: {},
  };
}

/** Vista abierta (la primera si la guardada no existe). */
export function activeView(db: Config): ViewConfig {
  return db.views.find((v) => v.id === db.active_view) ?? db.views[0] ?? newView("table");
}

/** Lo que se guarda de una base de datos cargada. */
export function configOf(db: Config): Config {
  return {
    columns: db.columns,
    views: db.views,
    active_view: db.active_view,
    subfolders: db.subfolders,
  };
}

export function getDatabase(path: string): Promise<Database> {
  return invoke<Database>("get_database", { path });
}

export function saveDatabaseConfig(path: string, config: Config): Promise<void> {
  return invoke<void>("save_database_config", { path, config });
}

/** Convierte una carpeta en base de datos (creándola si no existe). */
export function createDatabase(path: string): Promise<string> {
  return invoke<string>("create_database", { path });
}

/** Cambia una propiedad de una nota; `null` la quita. */
export function setProperty(
  path: string,
  key: string,
  value: PropValue,
): Promise<void> {
  return invoke<void>("set_property", { path, key, value });
}

/** Propiedades del frontmatter de un texto (sin leer ningún fichero). */
export function parseProperties(content: string): Promise<Props> {
  return invoke<Props>("parse_properties", { content });
}

export function getProperties(path: string): Promise<Props> {
  return invoke<Props>("get_properties", { path });
}

export function renameDatabaseProperty(
  path: string,
  old: string,
  newName: string,
): Promise<void> {
  return invoke<void>("rename_database_property", { path, old, new: newName });
}

export function deleteDatabaseProperty(path: string, key: string): Promise<void> {
  return invoke<void>("delete_database_property", { path, key });
}

/** Valores ya usados en cada columna, para sugerirlos al editar. */
export function columnOptions(db: Database): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const c of db.columns) {
    const set = new Set<string>();
    for (const r of db.rows) {
      const v = r.props[c.name];
      for (const item of Array.isArray(v) ? v : [v]) {
        if (item !== null && item !== undefined && item !== "") set.add(String(item));
      }
    }
    result[c.name] = [...set].sort((a, b) => a.localeCompare(b, "es"));
  }
  return result;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Tipo más probable de un valor (igual que en Rust). */
export function inferKind(value: PropValue | undefined): Kind {
  if (typeof value === "boolean") return "checkbox";
  if (typeof value === "number") return "number";
  if (Array.isArray(value))
    return value.length > 0 && value.every((v) => /^\s*\[\[.*\]\]\s*$/.test(String(v))) ? "relation" : "tags";
  if (typeof value === "string" && DATE.test(value)) return "date";
  return "text";
}

/** Texto de un valor, para filtrar y ordenar. */
export function valueText(value: PropValue | undefined): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

/**
 * Compara dos valores para ordenar. Los vacíos van siempre al final, tanto
 * en orden ascendente como descendente.
 */
export function compareValues(
  a: PropValue | undefined,
  b: PropValue | undefined,
  desc = false,
) {
  const emptyA = valueText(a) === "";
  const emptyB = valueText(b) === "";
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  let cmp: number;
  if (typeof a === "number" && typeof b === "number") cmp = a - b;
  else if (typeof a === "boolean" && typeof b === "boolean") cmp = Number(b) - Number(a);
  else
    cmp = valueText(a).localeCompare(valueText(b), "es", {
      numeric: true,
      sensitivity: "base",
    });
  return desc ? -cmp : cmp;
}
