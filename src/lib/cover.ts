import { displayUrl } from "./attachments";

/** Propiedades del frontmatter que dibujan la cabecera de la nota. */
export const ICON_KEY = "icono";
export const COVER_KEY = "portada";

/** Estilo de la página (como en Notion): ancho, tamaño y fuente del texto. */
export const WIDE_KEY = "ancho_completo";
export const SMALL_KEY = "texto_pequeño";
export const FONT_KEY = "fuente";

/** Propiedades de la página que no se ven como propiedades ni columnas. */
export const PAGE_KEYS: ReadonlySet<string> = new Set([ICON_KEY, COVER_KEY, WIDE_KEY, SMALL_KEY, FONT_KEY]);

export type PageFont = "normal" | "serif" | "mono";

export interface PageStyle {
  wide: boolean;
  small: boolean;
  font: PageFont;
}

/** Estilo de la página según sus propiedades. */
export function pageStyle(props: Record<string, unknown>): PageStyle {
  const font = String(props[FONT_KEY] ?? "").toLowerCase();
  return {
    wide: props[WIDE_KEY] === true,
    small: props[SMALL_KEY] === true,
    font: font === "serif" || font === "mono" ? font : "normal",
  };
}

/** Clases que aplican el estilo al editor (ver editor.css). */
export function pageClasses(style: PageStyle) {
  return [style.font !== "normal" && `page-${style.font}`, style.small && "page-small"].filter(Boolean).join(" ");
}

/** Portadas de color: en el fichero se guarda solo el nombre. */
export const COVERS: Record<string, string> = {
  violeta: "linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)",
  atardecer: "linear-gradient(135deg, #f97316 0%, #ec4899 100%)",
  océano: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)",
  bosque: "linear-gradient(135deg, #34d399 0%, #047857 100%)",
  arena: "linear-gradient(135deg, #fde68a 0%, #f59e0b 100%)",
  noche: "linear-gradient(135deg, #1e293b 0%, #6d28d9 100%)",
  rosa: "linear-gradient(135deg, #fbcfe8 0%, #f472b6 100%)",
  niebla: "linear-gradient(135deg, #e7e5e4 0%, #a8a29e 100%)",
};

/** Fondo CSS de la portada: un color de la lista o una imagen. */
export function coverBackground(value: string, vaultRoot: string, notePath: string) {
  const preset = COVERS[value.toLowerCase()];
  if (preset) return preset;
  const url = displayUrl(value, vaultRoot, notePath);
  return `center / cover no-repeat url("${url.replace(/"/g, "%22")}")`;
}
