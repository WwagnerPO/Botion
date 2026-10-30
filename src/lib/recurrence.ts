import { addMonths, WEEKDAYS } from "./naturalDate";
import { today } from "./slashCommands";

/**
 * Repeticiones de tareas: «cada día», «cada semana», «cada 2 meses»,
 * «cada lunes y jueves», «cada día laborable» (también en inglés: «every
 * week», como el plugin Tasks de Obsidian).
 */

const fold = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const plus = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

const UNITS: [RegExp, "day" | "week" | "month" | "year"][] = [
  [/^(?:dia|dias|day|days|diario|diaria)$/, "day"],
  [/^(?:semana|semanas|week|weeks|semanal)$/, "week"],
  [/^(?:mes|meses|month|months|mensual)$/, "month"],
  [/^(?:ano|anos|year|years|anual)$/, "year"],
];
const EN_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Opciones que se ofrecen al elegir la repetición. */
export const REPEAT_OPTIONS = ["cada día", "cada día laborable", "cada semana", "cada 2 semanas", "cada mes", "cada año"];

/** Siguiente fecha según la regla, o `null` si no se entiende. */
export function nextDate(iso: string, rule: string): string | null {
  const d = parse(iso);
  if (Number.isNaN(d.getTime())) return null;
  const r = fold(rule).replace(/^(?:cada|every|todos los|todas las)\s+/, "");
  if (/^(?:dia|day) (?:laborable|habil)$|^(?:dias )?laborables$|^weekday$/.test(r)) {
    let n = plus(d, 1);
    while (n.getDay() === 0 || n.getDay() === 6) n = plus(n, 1);
    return today(n);
  }
  const m = /^(\d+|un|una|otro|otra)?\s*([a-z]+)$/.exec(r);
  if (m) {
    const n = m[1] && /^\d+$/.test(m[1]) ? Number(m[1]) : m[1] === "otro" || m[1] === "otra" ? 2 : 1;
    const unit = UNITS.find(([re]) => re.test(m[2]))?.[1];
    if (unit === "day") return today(plus(d, n));
    if (unit === "week") return today(plus(d, 7 * n));
    if (unit === "month") return today(addMonths(d, n));
    if (unit === "year") return today(addMonths(d, 12 * n));
  }
  // cada lunes y jueves / every monday, thursday
  const days = r
    .split(/\s*(?:,|\by\b|\band\b)\s*/)
    .map((w) => {
      const s = w.replace(/s$/, "");
      const es = WEEKDAYS.indexOf(w) >= 0 ? WEEKDAYS.indexOf(w) : WEEKDAYS.indexOf(s);
      return es >= 0 ? es : EN_DAYS.indexOf(s.replace(/s$/, "")) >= 0 ? EN_DAYS.indexOf(s.replace(/s$/, "")) : EN_DAYS.indexOf(w);
    });
  if (days.length && days.every((x) => x >= 0)) {
    for (let i = 1; i <= 7; i++) {
      const n = plus(d, i);
      if (days.includes(n.getDay())) return today(n);
    }
  }
  return null;
}

const DATE_MARK = /(📅|⏰)\s*(\d{4}-\d{2}-\d{2})/gu;

/**
 * Cambios de fecha para la siguiente repetición de una tarea: el vencimiento
 * avanza según la regla y el recordatorio se mueve los mismos días.
 */
export function shiftedDates(text: string, rule: string): { from: string; to: string }[] | null {
  const marks = [...text.matchAll(DATE_MARK)];
  if (marks.length === 0) return null;
  const base = marks.find((m) => m[1] === "📅") ?? marks[0];
  const next = nextDate(base[2], rule);
  if (!next) return null;
  const delta = Math.round((parse(next).getTime() - parse(base[2]).getTime()) / 86_400_000);
  return marks.map((m) => ({
    from: m[0],
    to: `${m[1]} ${today(plus(parse(m[2]), delta))}`,
  }));
}

export const REPEAT_MARK = "🔁";
export const DONE_MARK = "✅";

/** Regla de repetición de una tarea (lo que va tras 🔁). */
export function repeatRule(text: string) {
  const m = /🔁\s*([^📅⏰✅🔁]+)/u.exec(text);
  return m ? m[1].trim() : null;
}

const CHECKBOX = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\].*)$/;

/**
 * Marca o desmarca la tarea de una línea. Al marcar una que se repite
 * devuelve dos líneas: la siguiente repetición (sin marcar) y la hecha.
 */
export function toggleTaskLine(line: string, done: boolean, on = today()): string[] {
  const cr = line.endsWith("\r") ? "\r" : "";
  const body = cr ? line.slice(0, -1) : line;
  const m = CHECKBOX.exec(body);
  if (!m) return [line];
  if (!done) {
    return [`${m[1]} ${m[3].replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/u, "")}${cr}`];
  }
  const doneLine = `${m[1]}x${m[3].replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/u, "")} ${DONE_MARK} ${on}${cr}`;
  const rule = repeatRule(m[3]);
  const shifts = rule ? shiftedDates(m[3], rule) : null;
  if (!shifts) return [doneLine];
  let next = m[3];
  for (const s of shifts) next = next.replace(s.from, s.to);
  return [`${m[1]} ${next}${cr}`, doneLine];
}
