import { GitCompare, TriangleAlert, X } from "lucide-react";
import type { SyncConflict } from "../lib/syncConflicts";

interface Props {
  conflicts: SyncConflict[];
  exists: (path: string) => boolean;
  /** Abre la copia a la derecha y la original a la izquierda para compararlas. */
  onCompare: (c: SyncConflict) => void;
  onResolve: (c: SyncConflict, choice: "mine" | "theirs" | "both") => void;
  onClose: () => void;
}

const noteName = (p: string) => p.replace(/\.md$/i, "");
const button =
  "rounded-md border border-neutral-200 px-2 py-1 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800";

/** Copias en conflicto de la sincronización (nube, Syncthing, WebDAV, Git). */
export function ConflictsPanel({ conflicts, exists, onCompare, onResolve, onClose }: Props) {
  return (
    <aside
      role="dialog"
      aria-label="Conflictos de sincronización"
      className="fixed top-0 right-0 bottom-0 z-30 flex w-[min(460px,94vw)] animate-pop flex-col border-l border-neutral-200 bg-white shadow-pop dark:border-neutral-800 dark:bg-neutral-950"
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-neutral-100 px-3 text-sm font-medium dark:border-neutral-800">
        <TriangleAlert className="size-4 text-amber-500" /> Conflictos de sincronización
        <button type="button" onClick={onClose} aria-label="Cerrar conflictos" className="ml-auto grid size-7 place-items-center rounded-md text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <X className="size-4" />
        </button>
      </div>
      <p className="px-4 pt-3 text-xs text-neutral-500">
        La misma nota cambió en dos sitios a la vez y el programa de sincronización guardó una copia. Compara y elige con cuál quedarte.
      </p>
      <ul className="flex-1 space-y-2 overflow-y-auto p-3">
        {conflicts.length === 0 && <li className="py-6 text-center text-sm text-neutral-400">No hay conflictos.</li>}
        {conflicts.map((c) => {
          const original = exists(c.original);
          return (
            <li key={c.copy} className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
              <p className="font-medium text-neutral-800 dark:text-neutral-100">{noteName(c.original)}</p>
              <p className="mt-0.5 text-xs text-neutral-400">
                Copia de {c.source}: {noteName(c.copy.split("/").pop()!)}
                {!original && " · la original ya no existe"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {original && (
                  <button type="button" className={`${button} flex items-center gap-1`} onClick={() => onCompare(c)}>
                    <GitCompare className="size-3.5" /> Comparar
                  </button>
                )}
                {original && (
                  <button type="button" className={button} onClick={() => onResolve(c, "mine")}>
                    Quedarme con la mía
                  </button>
                )}
                <button type="button" className={button} onClick={() => onResolve(c, "theirs")}>
                  {original ? "Usar la copia" : "Recuperarla"}
                </button>
                {original && (
                  <button type="button" className={button} onClick={() => onResolve(c, "both")}>
                    Guardar las dos
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
