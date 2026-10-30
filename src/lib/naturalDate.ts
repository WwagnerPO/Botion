import { today } from "./slashCommands";

/**
 * Fechas escritas en lenguaje natural: «mañana», «el viernes», «dentro de 3
 * días», «15 de noviembre a las 18:30»… Devuelve la fecha ISO y la hora.
 */

const fold = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const WEEKDAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const NUMBERS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30,
};

export interface NaturalDate {
  date: string;
  /** `HH:MM` si se ha dicho una hora. */
  time: string | null;
}

const at = (now: Date, days: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);

/** Suma meses sin pasarse de mes (31 de enero + 1 mes = 28 de febrero). */
export function addMonths(d: Date, months: number) {
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
}

function month(word: string) {
  if (word === "setiembre") return 8;
  const i = MONTHS.findIndex((m) => m === word || (word.length >= 3 && m.startsWith(word)));
  return i;
}

const number = (w: string) => (/^\d+$/.test(w) ? Number(w) : NUMBERS[w]);

/** Quita la hora del texto y la devuelve (`a las 9`, `18:30`, `9 pm`...). */
function takeTime(q: string): [string, string | null] {
  const pad = (n: number) => String(n).padStart(2, "0");
  const patterns: RegExp[] = [
    /(?:^|\s)(?:a las?|sobre las?|para las?)\s+(\d{1,2})(?::(\d{2}))?(?:\s*h)?(?:\s+(de la manana|de la tarde|de la noche|am|pm))?(?=\s|$)/,
    /(?:^|\s)(\d{1,2}):(\d{2})(?:\s*(am|pm))?(?=\s|$)/,
    /(?:^|\s)(\d{1,2})\s*(am|pm)(?=\s|$)/,
  ];
  for (const re of patterns) {
    const m = re.exec(q);
    if (!m) continue;
    let h = Number(m[1]);
    const min = m[2] && /^\d+$/.test(m[2]) ? Number(m[2]) : 0;
    const part = m[3] ?? (m[2] && !/^\d+$/.test(m[2]) ? m[2] : undefined);
    if ((part === "pm" || part === "de la tarde" || part === "de la noche") && h < 12) h += 12;
    if (part === "am" && h === 12) h = 0;
    if (h > 23 || min > 59) return [q, null];
    return [(q.slice(0, m.index) + " " + q.slice(m.index + m[0].length)).trim(), `${pad(h)}:${pad(min)}`];
  }
  if (/(?:^|\s)al mediodia$/.test(q)) return [q.replace(/\s*al mediodia$/, "").trim(), "12:00"];
  return [q, null];
}

function dateOf(q: string, now: Date): Date | null {
  q = q.replace(/^(?:para |el |la |este |esta )+/, (m) => (m.includes("este") || m.includes("esta") ? "este " : "")).trim();
  const simple: Record<string, number> = { hoy: 0, "esta noche": 0, manana: 1, "pasado manana": 2, ayer: -1, anteayer: -2 };
  if (q === "" || q in simple) return at(now, simple[q] ?? 0);

  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(q);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  // 15/11, 15-11-2026, 15/11/26
  m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(q);
  if (m) return withYear(Number(m[1]), Number(m[2]) - 1, m[3], now);

  // 15 de noviembre (de 2027), 15 nov
  m = /^(\d{1,2})(?: de)? ([a-z]+)\.?(?:(?: de)? (\d{4}))?$/.exec(q);
  if (m && month(m[2]) >= 0) return withYear(Number(m[1]), month(m[2]), m[3], now);

  // (este | próximo) viernes (que viene)
  m = /^(este |proximo |el proximo )?([a-z]+)( que viene| proximo)?$/.exec(q);
  if (m && WEEKDAYS.includes(m[2])) {
    const diff = (WEEKDAYS.indexOf(m[2]) - now.getDay() + 7) % 7;
    return at(now, m[1]?.startsWith("este") && !m[3] ? diff : diff || 7);
  }

  // dentro de 3 días, en una semana, en 2 meses
  m = /^(?:dentro de|en) ([a-z0-9]+) (dia|dias|semana|semanas|mes|meses|ano|anos)$/.exec(q);
  if (m && number(m[1]) !== undefined) {
    const n = number(m[1]);
    if (m[2].startsWith("dia")) return at(now, n);
    if (m[2].startsWith("semana")) return at(now, 7 * n);
    if (m[2].startsWith("mes")) return addMonths(at(now, 0), n);
    return addMonths(at(now, 0), 12 * n);
  }

  if (/^(?:semana que viene|proxima semana)$/.test(q)) return at(now, 7);
  if (/^(?:mes que viene|proximo mes)$/.test(q)) return addMonths(at(now, 0), 1);
  if (/^(?:ano que viene|proximo ano)$/.test(q)) return addMonths(at(now, 0), 12);
  if (/^(?:este )?fin de semana$/.test(q)) return at(now, (6 - now.getDay() + 7) % 7);
  if (/^(?:este )?fin de mes$/.test(q)) return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return null;
}

/** Día y mes sin año: el próximo que llegue. */
function withYear(day: number, monthIndex: number, year: string | undefined, now: Date) {
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
  let y = year ? Number(year.length === 2 ? `20${year}` : year) : now.getFullYear();
  let d = new Date(y, monthIndex, day);
  if (d.getMonth() !== monthIndex) return null;
  if (!year && d < at(now, 0)) d = new Date(++y, monthIndex, day);
  return d;
}

export function parseNaturalDate(input: string, now = new Date()): NaturalDate | null {
  const q = fold(input).trim().replace(/\s+/g, " ").replace(/[,.]$/, "");
  if (!q) return null;
  const [rest, time] = takeTime(q);
  const d = dateOf(rest, now);
  if (!d) return null;
  return { date: today(d), time };
}

/** «viernes, 31 de octubre» (con el año si no es el actual). */
export function formatDate(iso: string, now = new Date()) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(y !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}
