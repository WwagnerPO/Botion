import { useCallback, useEffect, useState } from "react";

/** Una pestaña: una nota o una base de datos. */
export interface Tab {
  kind: "note" | "database";
  path: string;
}

/** `true` si `path` es `base` o está dentro de la carpeta `base`. */
const inside = (path: string, base: string) => path === base || path.startsWith(base + "/");

/** Cambia las rutas que estaban en `oldPath` (nota o carpeta) a `newPath`. */
export function relocate(path: string, oldPath: string, newPath: string) {
  return inside(path, oldPath) ? newPath + path.slice(oldPath.length) : path;
}

function read(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Sin almacenamiento local: la lista dura hasta cerrar la app.
  }
}

/**
 * Lista de rutas guardada por bóveda en este ordenador (favoritas,
 * recientes). Se guarda fuera de las notas para no ensuciar la bóveda.
 */
export function usePathList(name: string, root: string | null, max = 50) {
  const key = `botion:${name}:${root ?? ""}`;
  const [list, setList] = useState<string[]>(() => (root ? read(key) : []));
  useEffect(() => setList(root ? read(key) : []), [key, root]);
  const update = useCallback(
    (f: (list: string[]) => string[]) =>
      setList((prev) => {
        const next = [...new Set(f(prev))].slice(0, max);
        if (root) write(key, next);
        return next;
      }),
    [key, root, max],
  );
  return [list, update] as const;
}

/** Interruptor guardado en este ordenador (índice lateral, sin distracciones). */
export function useStoredFlag(name: string) {
  const key = `botion:${name}`;
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  const set = useCallback(
    (f: boolean | ((on: boolean) => boolean)) =>
      setOn((prev) => {
        const next = typeof f === "function" ? f(prev) : f;
        try {
          localStorage.setItem(key, next ? "1" : "0");
        } catch {
          // Sin almacenamiento local: dura hasta cerrar la app.
        }
        return next;
      }),
    [key],
  );
  return [on, set] as const;
}
