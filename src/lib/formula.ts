/**
 * Fórmulas de las bases de datos, con una sintaxis parecida a la de Notion:
 *
 *     if(prop("hecha"), "✅", "⏳")
 *     prop("precio") * prop("cantidad")
 *     dateBetween(prop("fin"), today(), "days")
 *
 * Se analizan una vez y se evalúan para cada fila. No ejecutan código del
 * fichero: solo operadores y las funciones de la lista `FUNCTIONS`.
 */

export type FValue = number | string | boolean | Date | FValue[] | null;

export class FormulaError extends Error {}

type Node =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "call"; name: string; args: Node[] }
  | { t: "bin"; op: string; a: Node; b: Node }
  | { t: "un"; op: string; a: Node };

type Token =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "id"; v: string }
  | { k: "op"; v: string };

const OPS = ["==", "!=", "<=", ">=", "&&", "||", "+", "-", "*", "/", "%", "<", ">", "!", "(", ")", ",", "="];

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/\d/.test(c) || (c === "." && /\d/.test(src[i + 1] ?? ""))) {
      const m = /^\d*\.?\d+(?:[eE][+-]?\d+)?|^\d+\./.exec(src.slice(i))!;
      out.push({ k: "num", v: Number(m[0]) });
      i += m[0].length;
    } else if (c === '"' || c === "'" || c === "“") {
      const close = c === "“" ? "”" : c;
      let value = "";
      i++;
      while (i < src.length && src[i] !== close) {
        if (src[i] === "\\" && i + 1 < src.length) i++;
        value += src[i++];
      }
      if (i >= src.length) throw new FormulaError("Falta cerrar unas comillas");
      i++;
      out.push({ k: "str", v: value });
    } else if (/[\p{L}_]/u.test(c)) {
      const m = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(src.slice(i))!;
      out.push({ k: "id", v: m[0] });
      i += m[0].length;
    } else {
      const op = OPS.find((o) => src.startsWith(o, i));
      if (!op) throw new FormulaError(`Carácter no válido: «${c}»`);
      out.push({ k: "op", v: op === "=" ? "==" : op });
      i += op.length;
    }
  }
  return out;
}

// Precedencia de los operadores binarios (más alto = se aplica antes).
const BINARY: Record<string, number> = {
  "||": 1, or: 1, "&&": 2, and: 2,
  "==": 3, "!=": 3,
  "<": 4, "<=": 4, ">": 4, ">=": 4,
  "+": 5, "-": 5,
  "*": 6, "/": 6, "%": 6,
};

function parse(src: string): Node {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => {
    const t = peek();
    return !!t && (t.k === "op" || t.k === "id") && t.v === v;
  };
  const expect = (v: string) => {
    if (!isOp(v)) throw new FormulaError(`Se esperaba «${v}»`);
    pos++;
  };

  function primary(): Node {
    const t = tokens[pos++];
    if (!t) throw new FormulaError("La fórmula está incompleta");
    if (t.k === "num") return { t: "num", v: t.v };
    if (t.k === "str") return { t: "str", v: t.v };
    if (t.k === "op" && t.v === "(") {
      const e = expr(0);
      expect(")");
      return e;
    }
    if (t.k === "op" && (t.v === "-" || t.v === "!")) return { t: "un", op: t.v, a: unary() };
    if (t.k === "id") {
      const lower = t.v.toLowerCase();
      if (lower === "true" || lower === "verdadero") return { t: "bool", v: true };
      if (lower === "false" || lower === "falso") return { t: "bool", v: false };
      if (lower === "not") return { t: "un", op: "!", a: unary() };
      if (!isOp("(")) throw new FormulaError(`«${t.v}» no es una función; ¿quieres decir prop("${t.v}")?`);
      pos++;
      const args: Node[] = [];
      if (!isOp(")")) {
        do args.push(expr(0));
        while (isOp(",") && ++pos);
      }
      expect(")");
      return { t: "call", name: lower, args };
    }
    throw new FormulaError(`No se esperaba «${t.v}»`);
  }

  const unary = primary;

  function expr(min: number): Node {
    let left = unary();
    for (;;) {
      const t = peek();
      if (!t || (t.k !== "op" && t.k !== "id")) break;
      const prec = BINARY[t.v.toLowerCase()];
      if (prec === undefined || prec < min) break;
      pos++;
      const right = expr(prec + 1);
      const op = t.v.toLowerCase() === "or" ? "||" : t.v.toLowerCase() === "and" ? "&&" : t.v;
      left = { t: "bin", op, a: left, b: right };
    }
    return left;
  }

  const tree = expr(0);
  if (pos < tokens.length) throw new FormulaError(`Sobra «${tokens[pos].v}»`);
  return tree;
}

/** Lo que la fórmula puede leer de la fila. */
export interface FormulaContext {
  prop: (name: string) => FValue;
  /** Fecha actual (se puede fijar en las pruebas). */
  now?: Date;
}

export function truthy(v: FValue): boolean {
  if (Array.isArray(v)) return v.length > 0;
  return v !== null && v !== false && v !== 0 && v !== "";
}

const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

function dateText(d: Date, pattern?: string) {
  const time = d.getHours() || d.getMinutes();
  const p = pattern ?? (time ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD");
  return p.replace(/YYYY|MMM|MM|DD|HH|mm|D/g, (tok) =>
    ({
      YYYY: String(d.getFullYear()),
      MMM: MONTHS[d.getMonth()],
      MM: pad(d.getMonth() + 1),
      DD: pad(d.getDate()),
      D: String(d.getDate()),
      HH: pad(d.getHours()),
      mm: pad(d.getMinutes()),
    })[tok]!,
  );
}

/** Texto de un valor de fórmula. */
export function text(v: FValue): string {
  if (v === null) return "";
  if (v instanceof Date) return dateText(v);
  if (Array.isArray(v)) return v.map(text).join(", ");
  if (typeof v === "number") return String(Math.round(v * 1e10) / 1e10);
  return String(v);
}

function num(v: FValue, fn: string): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return Number(v);
  if (v instanceof Date) return v.getTime();
  if (v === null || v === "") return 0;
  const n = Number(String(v).replace(",", "."));
  if (Number.isNaN(n)) throw new FormulaError(`${fn}: «${text(v)}» no es un número`);
  return n;
}

/** «2026-10-25» o «2026-10-25 14:30» → fecha local. */
export function parseDate(v: FValue): Date | null {
  if (v instanceof Date) return v;
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(v);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
}

function date(v: FValue, fn: string): Date {
  const d = parseDate(v);
  if (!d) throw new FormulaError(`${fn}: «${text(v)}» no es una fecha`);
  return d;
}

const UNITS: Record<string, string> = {
  years: "years", year: "years", años: "years", año: "years",
  months: "months", month: "months", meses: "months", mes: "months",
  weeks: "weeks", week: "weeks", semanas: "weeks", semana: "weeks",
  days: "days", day: "days", días: "days", dias: "days", día: "days", dia: "days",
  hours: "hours", hour: "hours", horas: "hours", hora: "hours",
  minutes: "minutes", minute: "minutes", minutos: "minutes", minuto: "minutes",
};

function unit(v: FValue, fn: string) {
  const u = UNITS[text(v).toLowerCase()];
  if (!u) throw new FormulaError(`${fn}: unidad no válida «${text(v)}» (days, weeks, months…)`);
  return u;
}

function addTo(d: Date, n: number, u: string) {
  const r = new Date(d);
  if (u === "years") r.setFullYear(r.getFullYear() + n);
  else if (u === "months") r.setMonth(r.getMonth() + n);
  else if (u === "weeks") r.setDate(r.getDate() + 7 * n);
  else if (u === "days") r.setDate(r.getDate() + n);
  else if (u === "hours") r.setHours(r.getHours() + n);
  else r.setMinutes(r.getMinutes() + n);
  return r;
}

function between(a: Date, b: Date, u: string) {
  const ms = a.getTime() - b.getTime();
  const months = (a.getFullYear() - b.getFullYear()) * 12 + a.getMonth() - b.getMonth();
  const value =
    u === "years" ? months / 12
    : u === "months" ? months
    : u === "weeks" ? ms / 6048e5
    : u === "days" ? ms / 864e5
    : u === "hours" ? ms / 36e5
    : ms / 6e4;
  return Math.trunc(Math.round(value * 1e6) / 1e6);
}

const list = (v: FValue): FValue[] => (Array.isArray(v) ? v : v === null || v === "" ? [] : [v]);
const flat = (args: FValue[]) => args.flatMap(list);

function equal(a: FValue, b: FValue): boolean {
  if (a instanceof Date || b instanceof Date) {
    const da = parseDate(a);
    const db = parseDate(b);
    return !!da && !!db && da.getTime() === db.getTime();
  }
  if (typeof a === "number" || typeof b === "number") {
    if (a === null || b === null || a === "" || b === "") return a === b;
    return num(a, "==") === num(b, "==");
  }
  return text(a) === text(b);
}

function compare(a: FValue, b: FValue): number {
  const da = parseDate(a);
  const db = parseDate(b);
  if ((a instanceof Date || b instanceof Date) && da && db) return da.getTime() - db.getTime();
  if (typeof a === "number" || typeof b === "number") return num(a, "<") - num(b, "<");
  return text(a).localeCompare(text(b), "es", { numeric: true });
}

type Fn = (args: FValue[], ctx: FormulaContext) => FValue;

const arity = (name: string, args: FValue[], min: number, max = min) => {
  if (args.length < min || args.length > max) {
    const n = min === max ? `${min}` : `${min} a ${max}`;
    throw new FormulaError(`${name} necesita ${n} ${max === 1 ? "valor" : "valores"}`);
  }
};

const FUNCTIONS: Record<string, Fn> = {
  not: (a) => (arity("not", a, 1), !truthy(a[0])),
  empty: (a) => (arity("empty", a, 1), !truthy(a[0])),
  length: (a) => (arity("length", a, 1), Array.isArray(a[0]) ? a[0].length : text(a[0]).length),
  concat: (a) => (a.some(Array.isArray) ? flat(a) : a.map(text).join("")),
  join: (a) => (arity("join", a, 1, 2), list(a[0]).map(text).join(a.length > 1 ? text(a[1]) : ", ")),
  contains: (a) => {
    arity("contains", a, 2);
    if (Array.isArray(a[0])) return a[0].some((x) => equal(x, a[1]));
    return text(a[0]).toLowerCase().includes(text(a[1]).toLowerCase());
  },
  lower: (a) => (arity("lower", a, 1), text(a[0]).toLowerCase()),
  upper: (a) => (arity("upper", a, 1), text(a[0]).toUpperCase()),
  trim: (a) => (arity("trim", a, 1), text(a[0]).trim()),
  replace: (a) => (arity("replace", a, 3), text(a[0]).replace(text(a[1]), text(a[2]))),
  replaceall: (a) => (arity("replaceAll", a, 3), text(a[0]).split(text(a[1])).join(text(a[2]))),
  substring: (a) => {
    arity("substring", a, 2, 3);
    return text(a[0]).slice(num(a[1], "substring"), a.length > 2 ? num(a[2], "substring") : undefined);
  },
  format: (a) => (arity("format", a, 1), text(a[0])),
  tonumber: (a) => (arity("toNumber", a, 1), num(a[0], "toNumber")),
  round: (a) => {
    arity("round", a, 1, 2);
    const f = 10 ** (a.length > 1 ? num(a[1], "round") : 0);
    return Math.round(num(a[0], "round") * f) / f;
  },
  floor: (a) => (arity("floor", a, 1), Math.floor(num(a[0], "floor"))),
  ceil: (a) => (arity("ceil", a, 1), Math.ceil(num(a[0], "ceil"))),
  abs: (a) => (arity("abs", a, 1), Math.abs(num(a[0], "abs"))),
  sqrt: (a) => (arity("sqrt", a, 1), Math.sqrt(num(a[0], "sqrt"))),
  pow: (a) => (arity("pow", a, 2), num(a[0], "pow") ** num(a[1], "pow")),
  min: (a) => {
    const v = flat(a).filter((x) => x !== null && x !== "");
    return v.length ? v.reduce((m, x) => (compare(x, m) < 0 ? x : m)) : null;
  },
  max: (a) => {
    const v = flat(a).filter((x) => x !== null && x !== "");
    return v.length ? v.reduce((m, x) => (compare(x, m) > 0 ? x : m)) : null;
  },
  sum: (a) => flat(a).reduce<number>((s, x) => s + num(x, "sum"), 0),
  average: (a) => {
    const v = flat(a).filter((x) => x !== null && x !== "");
    return v.length ? v.reduce<number>((s, x) => s + num(x, "average"), 0) / v.length : null;
  },
  now: (a, ctx) => (arity("now", a, 0), new Date(ctx.now ?? Date.now())),
  today: (a, ctx) => {
    arity("today", a, 0);
    const d = new Date(ctx.now ?? Date.now());
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  },
  dateadd: (a) => (arity("dateAdd", a, 3), addTo(date(a[0], "dateAdd"), num(a[1], "dateAdd"), unit(a[2], "dateAdd"))),
  datesubtract: (a) => (
    arity("dateSubtract", a, 3),
    addTo(date(a[0], "dateSubtract"), -num(a[1], "dateSubtract"), unit(a[2], "dateSubtract"))
  ),
  datebetween: (a) => (
    arity("dateBetween", a, 3),
    between(date(a[0], "dateBetween"), date(a[1], "dateBetween"), unit(a[2], "dateBetween"))
  ),
  formatdate: (a) => (arity("formatDate", a, 1, 2), dateText(date(a[0], "formatDate"), a.length > 1 ? text(a[1]) : "D MMM YYYY")),
  year: (a) => (arity("year", a, 1), date(a[0], "year").getFullYear()),
  month: (a) => (arity("month", a, 1), date(a[0], "month").getMonth() + 1),
  day: (a) => (arity("day", a, 1), date(a[0], "day").getDate()),
  // Día de la semana: 1 = lunes … 7 = domingo.
  weekday: (a) => (arity("weekday", a, 1), ((date(a[0], "weekday").getDay() + 6) % 7) + 1),
};

// Alias en español de las más usadas.
Object.assign(FUNCTIONS, {
  vacio: FUNCTIONS.empty,
  vacío: FUNCTIONS.empty,
  longitud: FUNCTIONS.length,
  concatenar: FUNCTIONS.concat,
  contiene: FUNCTIONS.contains,
  redondear: FUNCTIONS.round,
  suma: FUNCTIONS.sum,
  media: FUNCTIONS.average,
  hoy: FUNCTIONS.today,
  ahora: FUNCTIONS.now,
});

/** Nombres de funciones, para la ayuda del editor de fórmulas. */
export const FUNCTION_NAMES = [
  "prop", "if", "and", "or", "not", "empty", "length", "concat", "join", "contains",
  "lower", "upper", "trim", "replace", "replaceAll", "substring", "format", "toNumber",
  "round", "floor", "ceil", "abs", "sqrt", "pow", "min", "max", "sum", "average",
  "now", "today", "dateAdd", "dateSubtract", "dateBetween", "formatDate",
  "year", "month", "day", "weekday",
];

function evaluate(node: Node, ctx: FormulaContext): FValue {
  switch (node.t) {
    case "num":
    case "str":
    case "bool":
      return node.v;
    case "un": {
      const v = evaluate(node.a, ctx);
      return node.op === "!" ? !truthy(v) : -num(v, "-");
    }
    case "bin": {
      const { op } = node;
      if (op === "&&") return truthy(evaluate(node.a, ctx)) && truthy(evaluate(node.b, ctx));
      if (op === "||") return truthy(evaluate(node.a, ctx)) || truthy(evaluate(node.b, ctx));
      const a = evaluate(node.a, ctx);
      const b = evaluate(node.b, ctx);
      switch (op) {
        case "+":
          if (Array.isArray(a) || Array.isArray(b)) return [...list(a), ...list(b)];
          if (typeof a === "string" || typeof b === "string" || a instanceof Date || b instanceof Date)
            return text(a) + text(b);
          return num(a, "+") + num(b, "+");
        case "-": return num(a, "-") - num(b, "-");
        case "*": return num(a, "*") * num(b, "*");
        case "/": {
          const d = num(b, "/");
          if (d === 0) throw new FormulaError("División entre cero");
          return num(a, "/") / d;
        }
        case "%": return num(a, "%") % num(b, "%");
        case "==": return equal(a, b);
        case "!=": return !equal(a, b);
        case "<": return compare(a, b) < 0;
        case "<=": return compare(a, b) <= 0;
        case ">": return compare(a, b) > 0;
        case ">=": return compare(a, b) >= 0;
      }
      throw new FormulaError(`Operador desconocido «${op}»`);
    }
    case "call": {
      const { name, args } = node;
      // Funciones que no evalúan todos sus argumentos.
      if (name === "prop" || name === "propiedad") {
        if (args.length !== 1 || args[0].t !== "str")
          throw new FormulaError('prop necesita el nombre de una propiedad entre comillas: prop("estado")');
        return ctx.prop(args[0].v);
      }
      if (name === "if" || name === "si") {
        if (args.length !== 3) throw new FormulaError("if necesita 3 valores: if(condición, sí, no)");
        return truthy(evaluate(args[0], ctx)) ? evaluate(args[1], ctx) : evaluate(args[2], ctx);
      }
      if (name === "and" || name === "y") return args.every((a) => truthy(evaluate(a, ctx)));
      if (name === "or" || name === "o") return args.some((a) => truthy(evaluate(a, ctx)));
      const fn = FUNCTIONS[name];
      if (!fn) throw new FormulaError(`No existe la función «${name}»`);
      return fn(args.map((a) => evaluate(a, ctx)), ctx);
    }
  }
}

const cache = new Map<string, Node | FormulaError>();

/** Analiza la fórmula (con caché). Lanza `FormulaError` si no es válida. */
function compile(src: string): Node {
  let hit = cache.get(src);
  if (!hit) {
    try {
      hit = parse(src);
    } catch (e) {
      hit = e instanceof FormulaError ? e : new FormulaError(String(e));
    }
    if (cache.size > 500) cache.clear();
    cache.set(src, hit);
  }
  if (hit instanceof FormulaError) throw hit;
  return hit;
}

/** Error de sintaxis de la fórmula, o `null` si es válida. */
export function checkFormula(src: string): string | null {
  if (!src.trim()) return "La fórmula está vacía";
  try {
    compile(src);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

/** Evalúa la fórmula. Lanza `FormulaError` con un mensaje en español. */
export function runFormula(src: string, ctx: FormulaContext): FValue {
  if (!src.trim()) return null;
  return evaluate(compile(src), ctx);
}
