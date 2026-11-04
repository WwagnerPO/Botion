import { invoke } from "@tauri-apps/api/core";

export type Update = import("@tauri-apps/plugin-updater").Update;

/** La versión nueva, si la hay. `null` si está al día o si esta versión no se actualiza sola. */
export async function checkForUpdate(): Promise<Update | null> {
  if (!(await invoke<boolean>("updater_enabled").catch(() => false))) return null;
  const { check } = await import("@tauri-apps/plugin-updater");
  return check();
}

export const updaterEnabled = () => invoke<boolean>("updater_enabled").catch(() => false);

/** Descarga e instala la actualización y reinicia la app. */
export async function installUpdate(update: Update, onProgress: (percent: number | null) => void) {
  let total = 0;
  let done = 0;
  await update.downloadAndInstall((e) => {
    if (e.event === "Started") total = e.data.contentLength ?? 0;
    if (e.event === "Progress") {
      done += e.data.chunkLength;
      onProgress(total ? Math.round((done / total) * 100) : null);
    }
  });
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}

export const importNotion = (source: string) =>
  invoke<{ folder: string; notes: number; databases: number; files: number }>("import_notion", { source });
