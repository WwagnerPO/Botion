import { invoke } from "@tauri-apps/api/core";

export type Kind = "text" | "number" | "checkbox" | "date" | "select" | "tags";

export type PropValue = string | number | boolean | string[] | null;
export type Props = Record<string, PropValue>;

export interface Column {
  name: string;
  kind: Kind;
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
}

export type View = "table" | "board" | "calendar";

/** Lo que se guarda en `.botion-db.json`. */
export interface Config {
  columns: Column[];
  sort: Sort | null;
  view: View;
  /** Columna de selección que agrupa el kanban. */
  group_by: string | null;
  /** Columna de fecha que usa el calendario. */
  date_by: string | null;
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
};

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
export function inferKind(value: PropValue): Kind {
  if (typeof value === "boolean") return "checkbox";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "tags";
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
