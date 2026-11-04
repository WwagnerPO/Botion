import { Cloud, CloudOff, RefreshCw, Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { describeReport, webdavSave, webdavSettings, webdavSync, type WebDavReport, type WebDavSettings } from "../lib/webdav";
import { Popover } from "./Popover";

interface Props {
  root: string;
  beforeSync: () => Promise<void>;
  onSynced: (report: WebDavReport, message: string) => void;
  onError: (message: string) => void;
  /** Abre los ajustes desde fuera (paleta de comandos). */
  openRef: React.MutableRefObject<(() => void) | null>;
}

const input =
  "mt-1 block w-full rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm outline-none focus:border-violet-400 dark:border-neutral-700 dark:bg-neutral-900";

/** Sincronización con WebDAV al pie de la barra lateral (si está configurada). */
export function WebDavPanel({ root, beforeSync, onSynced, onError, openRef }: Props) {
  const [settings, setSettings] = useState<WebDavSettings | null>(null);
  const [editing, setEditing] = useState<HTMLElement | DOMRect | null>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const handlers = useRef({ beforeSync, onSynced, onError });
  handlers.current = { beforeSync, onSynced, onError };
  const anchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    webdavSettings().then(setSettings).catch(() => setSettings(null));
  }, [root]);

  openRef.current = () => setEditing(anchor.current?.getBoundingClientRect() ?? new DOMRect(16, window.innerHeight - 80, 0, 0));

  const sync = useCallback(async () => {
    setBusy(true);
    try {
      await handlers.current.beforeSync();
      const report = await webdavSync();
      setLast(new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }));
      handlers.current.onSynced(report, describeReport(report));
    } catch (e) {
      handlers.current.onError(String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!settings?.auto) return;
    const id = setInterval(sync, 5 * 60_000);
    return () => clearInterval(id);
  }, [settings?.auto, sync]);

  return (
    <div ref={anchor}>
      {settings && (
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <Cloud className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate" title={settings.url}>
            WebDAV{last ? ` · ${last}` : ""}
          </span>
          <button type="button" disabled={busy} onClick={sync} className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-neutral-200/70 disabled:opacity-50 dark:hover:bg-neutral-800">
            <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} /> Sincronizar
          </button>
          <button type="button" onClick={(e) => setEditing(e.currentTarget)} aria-label="Ajustes de WebDAV" className="rounded p-0.5 hover:bg-neutral-200/70 dark:hover:bg-neutral-800">
            <Settings className="size-3.5" />
          </button>
        </div>
      )}
      {editing && (
        <Popover anchor={editing} onClose={() => setEditing(null)} className="w-80 p-3">
          <SettingsForm
            initial={settings}
            onSave={async (s) => {
              try {
                await webdavSave(s);
                setSettings(s);
                setEditing(null);
                if (s) sync();
              } catch (e) {
                handlers.current.onError(String(e));
              }
            }}
          />
        </Popover>
      )}
    </div>
  );
}

function SettingsForm({ initial, onSave }: { initial: WebDavSettings | null; onSave: (s: WebDavSettings | null) => void }) {
  const [s, setS] = useState<WebDavSettings>(initial ?? { url: "", user: "", password: "", auto: false });
  const set = (patch: Partial<WebDavSettings>) => setS((x) => ({ ...x, ...patch }));
  return (
    <form
      className="space-y-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (s.url.trim()) onSave({ ...s, url: s.url.trim() });
      }}
    >
      <p className="flex items-center gap-1.5 font-medium">
        <Cloud className="size-4 text-violet-500" /> Sincronizar con WebDAV
      </p>
      <p className="text-xs text-neutral-400">Nextcloud, ownCloud, Synology, Fastmail… Usa la dirección de una carpeta vacía para esta bóveda.</p>
      <label className="block text-xs text-neutral-500">
        Dirección
        <input autoFocus className={input} value={s.url} placeholder="https://nube.ejemplo.com/remote.php/dav/files/ana/Notas" onChange={(e) => set({ url: e.target.value })} />
      </label>
      <label className="block text-xs text-neutral-500">
        Usuario
        <input className={input} value={s.user} autoComplete="username" onChange={(e) => set({ user: e.target.value })} />
      </label>
      <label className="block text-xs text-neutral-500">
        Contraseña (mejor una «contraseña de aplicación»)
        <input className={input} type="password" value={s.password} autoComplete="current-password" onChange={(e) => set({ password: e.target.value })} />
      </label>
      <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
        <input type="checkbox" className="accent-violet-600" checked={s.auto} onChange={(e) => set({ auto: e.target.checked })} />
        Sincronizar sola cada 5 minutos
      </label>
      <div className="flex items-center justify-between pt-1">
        {initial ? (
          <button type="button" onClick={() => onSave(null)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950">
            <CloudOff className="size-3.5" /> Dejar de sincronizar
          </button>
        ) : (
          <span />
        )}
        <button type="submit" className="rounded-md bg-violet-600 px-3 py-1 text-sm font-medium text-white hover:bg-violet-700">
          Guardar y sincronizar
        </button>
      </div>
    </form>
  );
}
