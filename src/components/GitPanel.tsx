import { useCallback, useEffect, useRef, useState } from "react";
import {
  describeSync,
  getAutoSync,
  gitInit,
  gitStatus,
  gitSync,
  setAutoSync,
  type GitStatus,
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

  useEffect(() => {
    if (!auto || !status?.repo) return;
    const timer = window.setInterval(() => sync(true), AUTO_MINUTES * 60_000);
    return () => window.clearInterval(timer);
  }, [auto, status?.repo, sync]);

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
