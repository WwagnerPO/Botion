import { useEffect, useState } from "react";
import { applyTheme, getTheme, type Theme } from "../lib/theme";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "system", label: "Sistema" },
];

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getTheme);
  // Por si se cambia desde la paleta de comandos.
  useEffect(() => {
    const onTheme = (e: Event) => setTheme((e as CustomEvent<Theme>).detail);
    window.addEventListener("botion-theme", onTheme);
    return () => window.removeEventListener("botion-theme", onTheme);
  }, []);

  function choose(value: Theme) {
    setTheme(value);
    applyTheme(value);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="flex rounded-md bg-neutral-200/70 p-0.5 text-xs dark:bg-neutral-800"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          onClick={() => choose(o.value)}
          className={`flex-1 rounded px-2 py-1 ${
            theme === o.value
              ? "bg-white font-medium text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100"
              : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
