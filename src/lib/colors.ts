/**
 * Colores de Notion para texto, fondos y filas de tablas. En las notas se
 * guarda el color claro en HTML (`<span style="color: #d44c47">`), que
 * también entiende Obsidian; en la app se cambia por el oscuro si toca.
 */
export const COLORS = {
  gris: { label: "Gris", text: "#787774", bg: "#f1f1ef", darkText: "#9b9b9b", darkBg: "#2f2f2f" },
  marrón: { label: "Marrón", text: "#9f6b53", bg: "#f4eeee", darkText: "#ba856f", darkBg: "#4a3228" },
  naranja: { label: "Naranja", text: "#d9730d", bg: "#fbecdd", darkText: "#c77d48", darkBg: "#5c3b23" },
  amarillo: { label: "Amarillo", text: "#cb912f", bg: "#fbf3db", darkText: "#ca9849", darkBg: "#564328" },
  verde: { label: "Verde", text: "#448361", bg: "#edf3ec", darkText: "#529e72", darkBg: "#243d30" },
  azul: { label: "Azul", text: "#337ea9", bg: "#e7f3f8", darkText: "#379ad3", darkBg: "#143a4e" },
  morado: { label: "Morado", text: "#9065b0", bg: "#f4f0f7", darkText: "#9d68d3", darkBg: "#3c2d49" },
  rosa: { label: "Rosa", text: "#c14c8a", bg: "#f9eef3", darkText: "#d15796", darkBg: "#4e2c3c" },
  rojo: { label: "Rojo", text: "#d44c47", bg: "#fdebec", darkText: "#df5452", darkBg: "#522e2a" },
} as const;

export type ColorName = keyof typeof COLORS;
export const COLOR_NAMES = Object.keys(COLORS) as ColorName[];

/** Nombre del color de la paleta a partir de un valor CSS (o `null`). */
export function colorName(css: string, kind: "text" | "bg"): ColorName | null {
  const v = css.trim().toLowerCase();
  for (const name of COLOR_NAMES) {
    const c = COLORS[name];
    if (v === name || v === (kind === "text" ? c.text : c.bg) || v === (kind === "text" ? c.darkText : c.darkBg)) return name;
  }
  return null;
}
