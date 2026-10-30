/**
 * Lo que hace una vista con las filas: calcular las columnas calculadas
 * (fórmulas, rollups, fechas del fichero), filtrar, ordenar, agrupar y
 * resumir al pie. Todo es puro para poder probarlo sin la app.
 */
import {
  compareValues,
  type Chart,
  type ColorRule,
  valueText,
  type Column,
  type Database,
  type Filter,
  type Kind,
  type PropValue,
  type Row,
  type ViewConfig,
} from "./database";
import { FormulaError, parseDate, runFormula, text, type FValue } from "./formula";

/** Bases de datos relacionadas ya cargadas, por carpeta. */
export type Related = Record<string, Database | undefined>;

export interface Ctx {
  db: Database;
  related: Related;
  now?: Date;
}

const fold = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const pad = (n: number) => String(n).padStart(2, "0");

/** Milisegundos → «2026-10-19 14:30» (ordenable y legible). */
export function stamp(ms: number | null): string | null {
  if (ms === null) return null;
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Destino de un enlace `[[Nota|alias]]` (o el texto tal cual). */
export function linkTarget(value: string) {
  const m = /^\s*\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]\s*$/.exec(value);
  return (m ? m[1] : value).trim();
}

/** Filas de `target` a las que apuntan los enlaces de una relación. */
export function relatedRows(value: PropValue | undefined, target: Database | undefined): Row[] {
  if (!target) return [];
  const links = Array.isArray(value) ? value : value ? [String(value)] : [];
  const out: Row[] = [];
  for (const link of links) {
    const t = fold(linkTarget(String(link)));
    const row = target.rows.find(
      (r) => fold(r.path.replace(/\.md$/i, "")) === t || fold(r.name) === t || fold(r.path.replace(/\.md$/i, "")).endsWith("/" + t),
    );
    if (row && !out.includes(row)) out.push(row);
  }
  return out;
}

export const ROLLUP_FUNCTIONS: Record<string, string> = {
  show: "Mostrar valores",
  count: "Contar todas",
  count_values: "Contar valores",
  unique: "Contar únicos",
  sum: "Suma",
  average: "Media",
  min: "Mínimo",
  max: "Máximo",
  percent_checked: "% marcadas",
  earliest: "Fecha más antigua",
  latest: "Fecha más reciente",
};

function rollupOf(fn: string, values: PropValue[], count: number): PropValue {
  const flatVals = values.flatMap((v) => (Array.isArray(v) ? v : [v])).filter((v) => valueText(v) !== "");
  const nums = flatVals.map(Number).filter((n) => Number.isFinite(n));
  const dates = flatVals.map((v) => String(v)).filter((v) => parseDate(v)).sort();
  switch (fn) {
    case "count": return count;
    case "count_values": return flatVals.length;
    case "unique": return new Set(flatVals.map((v) => fold(String(v)))).size;
    case "sum": return round(nums.reduce((a, b) => a + b, 0));
    case "average": return nums.length ? round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
    case "min": return nums.length ? Math.min(...nums) : null;
    case "max": return nums.length ? Math.max(...nums) : null;
    case "percent_checked":
      return values.length ? Math.round((values.filter((v) => v === true).length / values.length) * 100) : null;
    case "earliest": return dates[0] ?? null;
    case "latest": return dates[dates.length - 1] ?? null;
    default: return flatVals.map(String);
  }
}

const round = (n: number) => Math.round(n * 1e10) / 1e10;

/** Resultado de una fórmula convertido a valor de propiedad. */
function toProp(v: FValue): PropValue {
  if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return typeof v === "number" ? (Number.isFinite(v) ? round(v) : null) : v;
  if (Array.isArray(v)) return v.map(text);
  return text(v);
}

/** Valor de una propiedad tal como lo ve una fórmula. */
function toFormula(kind: Kind | undefined, v: PropValue): FValue {
  if (v === null || v === undefined) return null;
  if (kind === "date" || kind === "created" || kind === "edited") return parseDate(v as string) ?? (v as string);
  if (kind === "relation" && Array.isArray(v)) return v.map((x) => linkTarget(String(x)));
  if (kind === "number" && typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return v as FValue;
}

export interface Cell {
  value: PropValue;
  /** Error de la fórmula o del rollup, para enseñarlo en la celda. */
  error?: string;
}

/**
 * Valor de una celda, también de las columnas calculadas. `depth` evita que
 * dos fórmulas que se usan entre sí se llamen sin fin.
 */
export function cell(row: Row, column: Column, ctx: Ctx, depth = 0): Cell {
  switch (column.kind) {
    case "created": return { value: stamp(row.created) };
    case "edited": return { value: stamp(row.modified) };
    case "rollup": {
      const r = column.rollup;
      if (!r) return { value: null, error: "Elige la relación y la propiedad" };
      const relation = ctx.db.columns.find((c) => c.name === r.relation);
      if (!relation?.relation) return { value: null, error: `«${r.relation}» no es una relación` };
      const target = ctx.related[relation.relation];
      if (!target) return { value: null };
      const rows = relatedRows(row.props[relation.name], target);
      const prop = target.columns.find((c) => c.name === r.property);
      const values = rows.map((rr) =>
        r.property === "" || !prop ? rr.name : cell(rr, prop, { ...ctx, db: target }, depth + 1).value,
      );
      return { value: rollupOf(r.function, values, rows.length) };
    }
    case "formula": {
      if (depth > 8) return { value: null, error: "Las fórmulas se usan unas a otras sin fin" };
      try {
        const value = runFormula(column.formula ?? "", {
          now: ctx.now,
          prop: (name) => {
            const col = ctx.db.columns.find((c) => c.name === name);
            if (!col) {
              if (/^(nombre|name|título|titulo|title)$/i.test(name)) return row.name;
              throw new FormulaError(`No existe la propiedad «${name}»`);
            }
            const c = cell(row, col, ctx, depth + 1);
            if (c.error) throw new FormulaError(`${name}: ${c.error}`);
            return toFormula(col.kind, c.value);
          },
        });
        return { value: toProp(value) };
      } catch (e) {
        return { value: null, error: e instanceof Error ? e.message : String(e) };
      }
    }
    default:
      return { value: row.props[column.name] ?? null };
  }
}

/** Valor de la fila para una columna, o el nombre si `name` es `""`. */
export function valueOf(row: Row, name: string, ctx: Ctx): PropValue {
  if (name === "") return row.name;
  const col = ctx.db.columns.find((c) => c.name === name);
  return col ? cell(row, col, ctx).value : (row.props[name] ?? null);
}

// ---------------------------------------------------------------------------
// Filtros

export interface Operator {
  op: string;
  label: string;
  /** El operador no necesita valor (vacío, marcada…). */
  unary?: boolean;
}

const EMPTY: Operator[] = [
  { op: "empty", label: "está vacío", unary: true },
  { op: "not_empty", label: "no está vacío", unary: true },
];

const TEXT_OPS: Operator[] = [
  { op: "contains", label: "contiene" },
  { op: "not_contains", label: "no contiene" },
  { op: "is", label: "es" },
  { op: "is_not", label: "no es" },
  { op: "starts_with", label: "empieza por" },
  { op: "ends_with", label: "termina en" },
  ...EMPTY,
];

const NUMBER_OPS: Operator[] = [
  { op: "eq", label: "=" },
  { op: "neq", label: "≠" },
  { op: "gt", label: ">" },
  { op: "lt", label: "<" },
  { op: "gte", label: "≥" },
  { op: "lte", label: "≤" },
  ...EMPTY,
];

const DATE_OPS: Operator[] = [
  { op: "is", label: "es" },
  { op: "before", label: "antes de" },
  { op: "after", label: "después de" },
  { op: "on_or_before", label: "en o antes de" },
  { op: "on_or_after", label: "en o después de" },
  { op: "today", label: "es hoy", unary: true },
  { op: "past_week", label: "en la última semana", unary: true },
  { op: "next_week", label: "en la próxima semana", unary: true },
  { op: "past", label: "ya ha pasado", unary: true },
  { op: "future", label: "aún no ha llegado", unary: true },
  ...EMPTY,
];

const LIST_OPS: Operator[] = [
  { op: "contains", label: "contiene" },
  { op: "not_contains", label: "no contiene" },
  ...EMPTY,
];

const SELECT_OPS: Operator[] = [
  { op: "is", label: "es" },
  { op: "is_not", label: "no es" },
  ...EMPTY,
];

const CHECK_OPS: Operator[] = [
  { op: "checked", label: "está marcada", unary: true },
  { op: "unchecked", label: "no está marcada", unary: true },
];

/** Operadores que tiene sentido usar con cada tipo de columna. */
export function operatorsFor(kind: Kind): Operator[] {
  switch (kind) {
    case "number": return NUMBER_OPS;
    case "checkbox": return CHECK_OPS;
    case "date":
    case "created":
    case "edited": return DATE_OPS;
    case "select": return SELECT_OPS;
    case "tags":
    case "files":
    case "relation": return LIST_OPS;
    // Fórmulas y rollups pueden dar cualquier cosa: los más generales.
    case "formula":
    case "rollup": return [...TEXT_OPS.slice(0, 4), ...NUMBER_OPS.slice(2, 6), ...CHECK_OPS, ...EMPTY];
    default: return TEXT_OPS;
  }
}

const isEmpty = (v: PropValue) => (Array.isArray(v) ? v.length === 0 : valueText(v) === "");

function dayOf(v: PropValue): string | null {
  const d = parseDate(String(v ?? ""));
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : null;
}

function dayOffset(now: Date, days: number) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Comprueba un filtro sobre un valor ya calculado. */
export function matches(value: PropValue, f: Filter, now = new Date()): boolean {
  const target = f.value;
  const items = Array.isArray(value) ? value.map(String) : isEmpty(value) ? [] : [valueText(value)];
  const t = fold(valueText(target));
  switch (f.op) {
    case "empty": return isEmpty(value);
    case "not_empty": return !isEmpty(value);
    case "checked": return value === true || value === "true";
    case "unchecked": return !(value === true || value === "true");
    case "contains":
      return Array.isArray(value)
        ? items.some((i) => fold(linkTarget(i)) === t || fold(i) === t)
        : fold(valueText(value)).includes(t);
    case "not_contains":
      return Array.isArray(value)
        ? !items.some((i) => fold(linkTarget(i)) === t || fold(i) === t)
        : !fold(valueText(value)).includes(t);
    case "is": {
      const day = dayOf(value);
      const tday = dayOf(target);
      if (day && tday) return day === tday;
      return fold(valueText(value)) === t;
    }
    case "is_not": return !matches(value, { ...f, op: "is" }, now);
    case "starts_with": return fold(valueText(value)).startsWith(t);
    case "ends_with": return fold(valueText(value)).endsWith(t);
    case "eq":
    case "neq":
    case "gt":
    case "lt":
    case "gte":
    case "lte": {
      if (isEmpty(value) || valueText(target) === "") return f.op === "neq";
      const a = Number(value);
      const b = Number(String(target).replace(",", "."));
      const cmp = Number.isFinite(a) && Number.isFinite(b) ? a - b : compareValues(value, target);
      return { eq: cmp === 0, neq: cmp !== 0, gt: cmp > 0, lt: cmp < 0, gte: cmp >= 0, lte: cmp <= 0 }[f.op];
    }
    default: {
      const day = dayOf(value);
      if (!day) return false;
      const today = dayOffset(now, 0);
      const tday = dayOf(target) ?? "";
      switch (f.op) {
        case "before": return !!tday && day < tday;
        case "after": return !!tday && day > tday;
        case "on_or_before": return !!tday && day <= tday;
        case "on_or_after": return !!tday && day >= tday;
        case "today": return day === today;
        case "past_week": return day >= dayOffset(now, -7) && day <= today;
        case "next_week": return day >= today && day <= dayOffset(now, 7);
        case "past": return day < today;
        case "future": return day > today;
      }
      return true;
    }
  }
}

/** Filas de la vista: filtros, búsqueda rápida y orden. */
export function viewRows(view: ViewConfig, ctx: Ctx, search = ""): Row[] {
  const q = fold(search.trim());
  let rows = ctx.db.rows.filter((row) =>
    view.filters.every((f) => {
      // Un filtro de una columna que ya no existe no quita filas.
      if (f.column !== "" && !ctx.db.columns.some((c) => c.name === f.column)) return true;
      return matches(valueOf(row, f.column, ctx), f, ctx.now);
    }),
  );
  if (q) {
    rows = rows.filter(
      (r) =>
        fold(r.name).includes(q) ||
        ctx.db.columns.some((c) => fold(valueText(cell(r, c, ctx).value)).includes(q)),
    );
  }
  const sort = view.sort;
  if (sort) {
    rows = [...rows].sort((a, b) => compareValues(valueOf(a, sort.column, ctx), valueOf(b, sort.column, ctx), sort.desc));
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Grupos

export interface Group {
  /** Valor del grupo (`null` = sin valor). */
  key: string | null;
  rows: Row[];
}

/** Agrupa las filas por una columna. En las listas, una fila va en cada valor. */
export function groupRows(rows: Row[], column: Column, ctx: Ctx): Group[] {
  const groups = new Map<string | null, Row[]>();
  const add = (key: string | null, row: Row) => {
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  };
  for (const row of rows) {
    const v = cell(row, column, ctx).value;
    if (column.kind === "checkbox") add(v === true ? "Marcada" : "Sin marcar", row);
    else if (Array.isArray(v)) {
      if (v.length === 0) add(null, row);
      for (const item of v) add(column.kind === "relation" ? linkTarget(String(item)) : String(item), row);
    } else if (isEmpty(v)) add(null, row);
    else add(column.kind === "date" ? (dayOf(v) ?? valueText(v)) : valueText(v), row);
  }
  const keys = [...groups.keys()].filter((k) => k !== null) as string[];
  keys.sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  const out: Group[] = keys.map((key) => ({ key, rows: groups.get(key)! }));
  if (groups.has(null)) out.push({ key: null, rows: groups.get(null)! });
  return out;
}

// ---------------------------------------------------------------------------
// Totales al pie

export const TOTALS: Record<string, string> = {
  count: "Contar todas",
  count_values: "Contar valores",
  count_empty: "Contar vacías",
  unique: "Valores únicos",
  percent_empty: "% vacías",
  percent_not_empty: "% con valor",
  sum: "Suma",
  average: "Media",
  median: "Mediana",
  min: "Mínimo",
  max: "Máximo",
  range: "Rango",
  earliest: "Más antigua",
  latest: "Más reciente",
  checked: "Marcadas",
  unchecked: "Sin marcar",
  percent_checked: "% marcadas",
};

/** Totales que se pueden pedir para un tipo de columna. */
export function totalsFor(kind: Kind): string[] {
  const base = ["count", "count_values", "count_empty", "unique", "percent_empty", "percent_not_empty"];
  if (kind === "number" || kind === "formula" || kind === "rollup")
    return [...base, "sum", "average", "median", "min", "max", "range"];
  if (kind === "date" || kind === "created" || kind === "edited") return [...base, "earliest", "latest"];
  if (kind === "checkbox") return ["count", "checked", "unchecked", "percent_checked"];
  return base;
}

const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 2 });

/** Texto del total de una columna para las filas dadas. */
export function total(fn: string, values: PropValue[]): string {
  const n = values.length;
  const filled = values.filter((v) => !isEmpty(v));
  const nums = filled.map(Number).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const pct = (k: number) => (n ? `${Math.round((k / n) * 100)} %` : "—");
  const days = filled.map((v) => dayOf(v)).filter(Boolean).sort() as string[];
  const sum = nums.reduce((a, b) => a + b, 0);
  switch (fn) {
    case "count": return fmt(n);
    case "count_values": return fmt(filled.length);
    case "count_empty": return fmt(n - filled.length);
    case "unique": return fmt(new Set(filled.map((v) => fold(valueText(v)))).size);
    case "percent_empty": return pct(n - filled.length);
    case "percent_not_empty": return pct(filled.length);
    case "sum": return fmt(sum);
    case "average": return nums.length ? fmt(sum / nums.length) : "—";
    case "median": {
      if (!nums.length) return "—";
      const m = nums.length >> 1;
      return fmt(nums.length % 2 ? nums[m] : (nums[m - 1] + nums[m]) / 2);
    }
    case "min": return nums.length ? fmt(nums[0]) : "—";
    case "max": return nums.length ? fmt(nums[nums.length - 1]) : "—";
    case "range": return nums.length ? fmt(nums[nums.length - 1] - nums[0]) : "—";
    case "earliest": return days[0] ?? "—";
    case "latest": return days[days.length - 1] ?? "—";
    case "checked": return fmt(values.filter((v) => v === true).length);
    case "unchecked": return fmt(values.filter((v) => v !== true).length);
    case "percent_checked": return pct(values.filter((v) => v === true).length);
    default: return "";
  }
}

// ---------------------------------------------------------------------------
// Gráficos y formato condicional

export interface ChartPoint {
  label: string;
  value: number;
}

export const CHART_FUNCTIONS: Record<string, string> = {
  count: "Contar filas",
  sum: "Suma",
  average: "Media",
  min: "Mínimo",
  max: "Máximo",
};

/** Puntos del gráfico: filas agrupadas por `x` y resumidas con `y`. */
export function chartData(rows: Row[], chart: Chart, ctx: Ctx): ChartPoint[] {
  const summarize = (list: Row[]) => {
    if (chart.function === "count" || !chart.y) return list.length;
    const nums = list.map((r) => Number(valueOf(r, chart.y!, ctx))).filter((n) => Number.isFinite(n));
    if (nums.length === 0) return 0;
    switch (chart.function) {
      case "sum": return round(nums.reduce((a, b) => a + b, 0));
      case "average": return round(nums.reduce((a, b) => a + b, 0) / nums.length);
      case "min": return Math.min(...nums);
      case "max": return Math.max(...nums);
      default: return list.length;
    }
  };
  const column = ctx.db.columns.find((c) => c.name === chart.x);
  if (!column) return rows.length ? [{ label: "Todas", value: summarize(rows) }] : [];
  // Las fechas se agrupan por mes (2026-10), que es lo que suele interesar.
  if (["date", "created", "edited"].includes(column.kind)) {
    const months = new Map<string, Row[]>();
    for (const r of rows) {
      const day = dayOf(cell(r, column, ctx).value);
      const key = day ? day.slice(0, 7) : "Sin fecha";
      months.set(key, [...(months.get(key) ?? []), r]);
    }
    return [...months.keys()]
      .sort((a, b) => (a === "Sin fecha" ? 1 : b === "Sin fecha" ? -1 : a.localeCompare(b)))
      .map((k) => ({ label: k, value: summarize(months.get(k)!) }));
  }
  return groupRows(rows, column, ctx).map((g) => ({ label: g.key ?? `Sin ${column.name}`, value: summarize(g.rows) }));
}

/** Color de la primera regla que cumple la fila, o `null`. */
export function rowTint(row: Row, rules: ColorRule[] | undefined, ctx: Ctx, now = new Date()): string | null {
  for (const r of rules ?? []) {
    if (matches(valueOf(row, r.column, ctx), r, now)) return r.color;
  }
  return null;
}
