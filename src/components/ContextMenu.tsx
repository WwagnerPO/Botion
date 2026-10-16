import { useEffect, useRef } from "react";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointer(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector("button")?.focus();
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Que no se salga de la ventana.
  const left = Math.min(x, window.innerWidth - 200);
  const top = Math.min(y, window.innerHeight - items.length * 32 - 16);

  return (
    <div
      ref={ref}
      role="menu"
      style={{ left, top }}
      className="fixed z-50 w-48 rounded-md border border-neutral-200 bg-white p-1 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            item.onSelect();
          }}
          className={`block w-full rounded px-3 py-1.5 text-left hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none dark:hover:bg-neutral-700 dark:focus:bg-neutral-700 ${
            item.danger ? "text-red-600 dark:text-red-400" : ""
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
