import { today } from "./slashCommands";

const fold = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Fechas que se pueden mencionar con «@» según lo escrito. */
export function dateOptions(query: string, now = new Date()) {
  const day = (offset: number) => today(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));
  const options = [
    { label: "Hoy", date: day(0) },
    { label: "Mañana", date: day(1) },
    { label: "Ayer", date: day(-1) },
    { label: "Dentro de una semana", date: day(7) },
    ...WEEKDAYS.map((w, i) => ({
      label: `Próximo ${w}`,
      date: day(((i - now.getDay() + 7) % 7) || 7),
    })),
  ];
  const q = fold(query.trim());
  const exact = /^\d{4}-\d{2}-\d{2}$/.test(query.trim()) ? [{ label: query.trim(), date: query.trim() }] : [];
  const shown = options.filter((o) => !q || fold(o.label).includes(q) || o.date.startsWith(q));
  // Sin texto, solo las más usadas.
  return [...exact, ...(q ? shown : shown.slice(0, 3))];
}
