export type Theme = "system" | "light" | "dark";

const THEME_KEY = "botion:theme";
const media = window.matchMedia("(prefers-color-scheme: dark)");

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "light" || t === "dark") return t;
  } catch {
    // Sin almacenamiento: se usa el tema del sistema.
  }
  return "system";
}

/** Aplica el tema a la página y lo recuerda. */
export function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && media.matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  try {
    if (theme === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Sin almacenamiento: el tema no se recuerda.
  }
}

/** Vuelve a aplicar el tema si cambia el del sistema y se usa "system". */
export function watchSystemTheme() {
  media.addEventListener("change", () => {
    if (getTheme() === "system") applyTheme("system");
  });
}
