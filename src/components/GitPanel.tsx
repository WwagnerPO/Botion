import { useCallback, useEffect, useRef, useState } from "react";
import {
  describeSync,
  getAutoSync,
  gitInit,
  gitResolve,
  gitStatus,
  gitSync,
  setAutoSync,
  type GitStatus,
  type Strategy,
  type SyncResult,
} from "../lib/git";

interface Props {
  root: string;
  /** Guarda lo pendiente antes de sincronizar. */
  beforeSync: () => Promise<void>;
  onSynced: (result: SyncResult, message: string) => void;
  onError: (message: string) => void;
}

const AUTO_MINUTES = 5;

/** Estado de Git y botón de sincronizar, al pie de la barra lateral. */
export function GitPanel({ root, beforeSync, onSynced, onError }: Props) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(() => getAutoSync(root));
  /** Notas en conflicto esperando a que se elija cómo resolverlo. */
  const [conflicts, setConflicts] = useState<string[] | null>(null);
  // Las funciones del padre cambian en cada render; así el temporizador de
  // la sincronización automática no se reinicia cada vez.
  const handlers = useRef({ beforeSync, onSynced, onError });
  handlers.current = { beforeSync, onSynced, onError };

  const refresh = useCallback(async () => {
    try {
      setStatus(await gitStatus());
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    setAuto(getAutoSync(root));
    refresh();
  }, [root, refresh]);

  // Al volver a la ventana, por si hay cambios nuevos.
  useEffect(() => {
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  const sync = useCallback(
    async (quiet = false) => {
      setBusy(true);
      try {
        await handlers.current.beforeSync();
        const result = await gitSync();
        if (result.conflicts.length > 0) {
          setConflicts(result.conflicts);
          return;
        }
        if (!quiet || result.pulled) {
          handlers.current.onSynced(result, describeSync(result));
        }
      } catch (e) {
        handlers.current.onError(String(e));
      } finally {
        setBusy(false);
        refresh();
      }
    },
    [refresh],
  );

  // «Sincronizar con Git» desde la paleta de comandos.
  useEffect(() => {
    const onRequest = () => sync();
    window.addEventListener("botion-git-sync", onRequest);
    return () => window.removeEventListener("botion-git-sync", onRequest);
  }, [sync]);

  useEffect(() => {
    if (!auto || !status?.repo) return;
    const timer = window.setInterval(() => sync(true), AUTO_MINUTES * 60_000);
    return () => window.clearInterval(timer);
  }, [auto, status?.repo, sync]);

  async function resolve(strategy: Strategy) {
    setConflicts(null);
    setBusy(true);
    try {
      await handlers.current.beforeSync();
      const result = await gitResolve(strategy);
      handlers.current.onSynced(result, "Conflicto resuelto. " + describeSync(result));
    } catch (e) {
      handlers.current.onError(String(e));
    } finally {
      setBusy(false);
      refresh();
    }
  }

  const conflictDialog = conflicts && (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[18vh]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
        className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-5 text-sm shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        <h2 id="conflict-title" className="text-base font-semibold">
          Conflicto al sincronizar
        </h2>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Estas notas han cambiado aquí y en otro ordenador en las mismas partes:
        </p>
        <ul className="mt-2 list-disc pl-5">
          {conflicts.map((c) => (
            <li key={c}>{c.replace(/\.md$/, "")}</li>
          ))}
        </ul>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Lo que no choca se une solo. Para las partes que chocan, elige:
        </p>
        <div className="mt-4 grid gap-2">
          <button type="button" onClick={() => resolve("both")} className="rounded-md bg-neutral-900 px-3 py-2 text-left text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900">
            Guardar las dos
            <span className="block text-xs opacity-70">Mantiene la tuya y guarda la otra como «nota (remoto)».</span>
          </button>
          <button type="button" onClick={() => resolve("mine")} className="rounded-md border border-neutral-300 px-3 py-2 text-left hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
            Quedarme con la mía
          </button>
          <button type="button" onClick={() => resolve("theirs")} className="rounded-md border border-neutral-300 px-3 py-2 text-left hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
            Usar la del otro ordenador
          </button>
          <button type="button" onClick={() => setConflicts(null)} className="mt-1 px-3 py-1 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
            Decidir más tarde (tus cambios quedan guardados en Git)
          </button>
        </div>
      </div>
    </div>
  );

  if (!status) return null;

  if (!status.available) {
    return (
      <p className="text-xs text-neutral-400">
        Instala Git para sincronizar la bóveda.
      </p>
    );
  }

  if (!status.repo) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            setStatus(await gitInit());
          } catch (e) {
            onError(String(e));
          } finally {
            setBusy(false);
          }
        }}
        className="w-full rounded-md px-2 py-1 text-left text-xs text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 disabled:opacity-50 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        title="Guarda el historial de la bóveda con Git"
      >
        Activar historial con Git
      </button>
    );
  }

  const pending = [
    status.changes > 0 && `${status.changes} sin guardar`,
    status.ahead > 0 && `${status.ahead} por subir`,
    status.behind > 0 && `${status.behind} por bajar`,
  ].filter(Boolean);

  return (
    <div className="space-y-1 text-xs">
      {conflictDialog}
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-neutral-500" title={status.remote ?? "Sin remoto: solo historial local"}>
          Git · {status.branch ?? "sin rama"}
          {pending.length > 0 ? ` · ${pending.join(", ")}` : " · al día"}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => sync()}
          className="shrink-0 rounded px-2 py-0.5 text-neutral-600 hover:bg-neutral-200 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {busy ? "Sincronizando…" : "Sincronizar"}
        </button>
      </div>
      {!status.remote && (
        <p className="text-neutral-400">Sin remoto: el historial se guarda solo en este ordenador.</p>
      )}
      <label className="flex items-center gap-1.5 text-neutral-500">
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => {
            setAuto(e.target.checked);
            setAutoSync(root, e.target.checked);
          }}
          className="accent-violet-600"
        />
        Automática cada {AUTO_MINUTES} min
      </label>
    </div>
  );
}
