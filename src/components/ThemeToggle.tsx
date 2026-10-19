import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { applyTheme, getTheme, type Theme } from "../lib/theme";

const OPTIONS = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
  { value: "system", label: "Sistema", Icon: Monitor },
] as const satisfies readonly { value: Theme; label: string; Icon: unknown }[];

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
      className="flex rounded-lg bg-neutral-200/60 p-0.5 text-xs dark:bg-neutral-800/80"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          onClick={() => choose(o.value)}
          title={o.label}
          className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 transition-colors ${
            theme === o.value
              ? "bg-white font-medium text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100"
              : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          }`}
        >
          <o.Icon className="size-3.5" />
          {o.label}
        </button>
      ))}
    </div>
  );
}
