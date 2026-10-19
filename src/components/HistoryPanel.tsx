import { History, RotateCcw, Save, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { splitFrontmatter } from "../lib/frontmatter";
import { gitFileAt, gitHistory, gitSaveVersion, type Version } from "../lib/git";
import { toHtml } from "../lib/preview";

interface Props {
  path: string;
  onClose: () => void;
  /** Escribe `content` en la nota (antes se guarda lo pendiente). */
  onRestore: (content: string) => Promise<void>;
  /** Guarda lo pendiente del editor antes de crear una versión. */
  beforeSave: () => Promise<void>;
  onError: (message: string) => void;
}

const when = (secs: number) =>
  new Date(secs * 1000).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Versiones de la nota guardadas con Git: verlas y restaurar una. */
export function HistoryPanel({ path, onClose, onRestore, beforeSave, onError }: Props) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [selected, setSelected] = useState<Version | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setVersions(await gitHistory(path));
    } catch (e) {
      onError(String(e));
      setVersions([]);
    }
  }, [path, onError]);

  useEffect(() => {
    setSelected(null);
    setContent(null);
    load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    let current = true;
    setContent(null);
    gitFileAt(selected.hash, selected.path)
      .then((c) => current && setContent(c))
      .catch((e) => onError(String(e)));
    return () => {
      current = false;
    };
  }, [selected, onError]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function saveNow() {
    setBusy(true);
    try {
      await beforeSave();
      const saved = await gitSaveVersion(`Versión de «${path.split("/").pop()!.replace(/\.md$/, "")}»`);
      if (!saved) onError("No hay cambios desde la última versión.");
      await load();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const button =
    "flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800";

  return (
    <aside role="dialog" aria-label="Historial de la nota" className="fixed top-0 right-0 bottom-0 z-30 flex w-[min(720px,94vw)] animate-pop border-l border-neutral-200 bg-white shadow-pop dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex w-60 shrink-0 flex-col border-r border-neutral-200 dark:border-neutral-800">
        <div className="flex h-11 items-center gap-2 border-b border-neutral-100 px-3 text-sm font-medium dark:border-neutral-800">
          <History className="size-4 text-violet-500" /> Historial
        </div>
        <div className="p-2">
          <button type="button" onClick={saveNow} disabled={busy} className={`${button} w-full justify-center border border-neutral-200 dark:border-neutral-700`}>
            <Save className="size-4" /> Guardar versión ahora
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto px-2 pb-4">
          {versions === null && <li className="px-2 py-1 text-sm text-neutral-400">Cargando…</li>}
          {versions?.length === 0 && (
            <li className="px-2 py-1 text-sm text-neutral-400">
              Aún no hay versiones. Se guardan al sincronizar con Git o con el botón de arriba.
            </li>
          )}
          {versions?.map((v) => (
            <li key={v.hash}>
              <button
                type="button"
                onClick={() => setSelected(v)}
                className={`w-full rounded-md px-2 py-1.5 text-left ${
                  selected?.hash === v.hash ? "bg-violet-50 dark:bg-violet-950" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <span className="block text-sm font-medium">{when(v.date)}</span>
                <span className="block truncate text-xs text-neutral-500" title={v.message}>
                  {v.message || "Sin mensaje"}
                  {v.path !== path ? ` · era «${v.path}»` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-neutral-100 px-3 dark:border-neutral-800">
          {selected && (
            <button
              type="button"
              disabled={busy || content === null}
              onClick={async () => {
                setBusy(true);
                try {
                  await onRestore(content!);
                  onClose();
                } finally {
                  setBusy(false);
                }
              }}
              className="flex items-center gap-1.5 rounded-md bg-violet-600 px-2.5 py-1 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
            >
              <RotateCcw className="size-4" /> Restaurar esta versión
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Cerrar historial" className="ml-auto grid size-7 place-items-center rounded-md text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {!selected ? (
            <p className="text-sm text-neutral-400">Elige una versión para verla.</p>
          ) : content === null ? (
            <p className="text-sm text-neutral-400">Cargando…</p>
          ) : (
            <div className="peek-body" dangerouslySetInnerHTML={{ __html: toHtml(splitFrontmatter(content).body) }} />
          )}
        </div>
      </div>
    </aside>
  );
}
