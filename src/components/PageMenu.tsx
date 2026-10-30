import { Expand, ListTree, Maximize2, Type } from "lucide-react";
import type { PageFont, PageStyle } from "../lib/cover";
import { readingTime, type DocStats } from "../lib/outline";
import { Popover, PopoverItem } from "./Popover";

interface Props {
  anchor: HTMLElement;
  style: PageStyle;
  stats: DocStats | null;
  outline: boolean;
  focus: boolean;
  onClose: () => void;
  onFont: (font: PageFont) => void;
  onToggleWide: () => void;
  onToggleSmall: () => void;
  onToggleOutline: () => void;
  onToggleFocus: () => void;
  /** Más acciones (exportar...). */
  children?: React.ReactNode;
}

const FONTS: { font: PageFont; label: string; sample: string }[] = [
  { font: "normal", label: "Normal", sample: "font-sans" },
  { font: "serif", label: "Serif", sample: "font-serif" },
  { font: "mono", label: "Mono", sample: "font-mono" },
];

/** Menú «…» de la nota: fuente, ancho, tamaño, índice y modo sin distracciones. */
export function PageMenu({
  anchor,
  style,
  stats,
  outline,
  focus,
  onClose,
  onFont,
  onToggleWide,
  onToggleSmall,
  onToggleOutline,
  onToggleFocus,
  children,
}: Props) {
  return (
    <Popover anchor={anchor} onClose={onClose} alignRight className="w-64 p-1.5">
      <p className="px-1.5 pb-1 text-xs text-neutral-400">Estilo</p>
      <div className="mb-1 grid grid-cols-3 gap-1">
        {FONTS.map((f) => (
          <button
            key={f.font}
            type="button"
            onClick={() => onFont(f.font)}
            aria-pressed={style.font === f.font}
            className={`flex flex-col items-center rounded-md py-1.5 ${
              style.font === f.font
                ? "bg-violet-50 text-violet-700 ring-1 ring-violet-300 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-800"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700/70"
            }`}
          >
            <span className={`${f.sample} text-xl leading-7`}>Ag</span>
            <span className="text-[11px]">{f.label}</span>
          </button>
        ))}
      </div>
      <Toggle on={style.small} onClick={onToggleSmall} icon={<Type className="size-4" />}>
        Texto pequeño
      </Toggle>
      <Toggle on={style.wide} onClick={onToggleWide} icon={<Expand className="size-4" />}>
        Ancho completo
      </Toggle>
      <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />
      <Toggle on={outline} onClick={onToggleOutline} icon={<ListTree className="size-4" />}>
        Índice lateral
      </Toggle>
      <Toggle on={focus} onClick={onToggleFocus} icon={<Maximize2 className="size-4" />} hint="Ctrl .">
        Sin distracciones
      </Toggle>
      {children && <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />}
      {children}
      {stats && (
        <p className="mt-1 border-t border-neutral-200 px-2 pt-1.5 pb-0.5 text-xs text-neutral-400 dark:border-neutral-700">
          {stats.words.toLocaleString("es")} palabras · {stats.characters.toLocaleString("es")} caracteres ·{" "}
          {readingTime(stats.words)}
        </p>
      )}
    </Popover>
  );
}

function Toggle({
  on,
  onClick,
  icon,
  hint,
  children,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <PopoverItem onClick={onClick}>
      <span className="text-neutral-400">{icon}</span>
      <span className="flex-1">{children}</span>
      {hint && <kbd>{hint}</kbd>}
      <span
        aria-hidden
        className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${on ? "bg-violet-600" : "bg-neutral-300 dark:bg-neutral-600"}`}
      >
        <span className={`absolute top-0.5 size-3 rounded-full bg-white transition-all ${on ? "left-3.5" : "left-0.5"}`} />
      </span>
    </PopoverItem>
  );
}
