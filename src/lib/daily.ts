import { today } from "./slashCommands";

/** Carpeta de las notas diarias y nombre de su plantilla (en Plantillas/). */
export const DAILY_FOLDER = "Diario";
export const DAILY_TEMPLATE = "Diario";

/** Ruta de la nota diaria: `Diario/2026-10-30.md`. */
export function dailyPath(date = new Date()) {
  return `${DAILY_FOLDER}/${today(date)}.md`;
}
