import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  /** Elemento junto al que se abre (debajo, alineado a la izquierda). */
  anchor: HTMLElement | DOMRect;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Alinear por la derecha del ancla. */
  alignRight?: boolean;
}

/**
 * Panel flotante junto a un elemento. Se cierra al hacer clic fuera o con
 * Escape, y se recoloca para no salirse de la ventana.
 */
export function Popover({ anchor, onClose, children, className = "", alignRight }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const r = anchor instanceof HTMLElement ? anchor.getBoundingClientRect() : anchor;
    const el = ref.current!;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = alignRight ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.bottom + 4;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
    setPos({ left, top });
  }, [anchor, alignRight]);

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      // Los paneles abiertos desde este (submenús) no lo cierran.
      if ((target as HTMLElement).closest?.("[data-popover]")) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      data-popover
      style={pos ?? { left: -9999, top: -9999 }}
      className={`fixed z-50 animate-pop rounded-lg bg-white text-sm shadow-pop dark:bg-neutral-800 ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}

/** Botón de una lista dentro de un popover. */
export function PopoverItem({
  children,
  onClick,
  active,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700/70 ${
        danger ? "text-red-600 dark:text-red-400" : ""
      } ${active ? "font-medium text-violet-700 dark:text-violet-300" : ""}`}
    >
      {children}
    </button>
  );
}
