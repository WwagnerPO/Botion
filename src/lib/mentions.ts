import { formatDate, parseNaturalDate } from "./naturalDate";
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
  const shown = options.filter((o) => !q || fold(o.label).includes(q) || o.date.startsWith(q));
  // «el viernes», «dentro de 3 días», «15 de noviembre»...
  const natural = parseNaturalDate(query, now);
  const extra =
    natural && !shown.some((o) => o.date === natural.date)
      ? [{ label: capitalize(formatDate(natural.date, now)), date: natural.date, time: natural.time }]
      : [];
  // Sin texto, solo las más usadas.
  return [...extra, ...(q ? shown : shown.slice(0, 3))] as { label: string; date: string; time?: string | null }[];
}

const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
