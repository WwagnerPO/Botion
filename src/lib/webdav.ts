import { invoke } from "@tauri-apps/api/core";

export interface WebDavSettings {
  url: string;
  user: string;
  password: string;
  auto: boolean;
}

export interface WebDavReport {
  uploaded: number;
  downloaded: number;
  deleted: number;
  conflicts: string[];
  changed: string[];
}

export const webdavSettings = () => invoke<WebDavSettings | null>("webdav_settings");
export const webdavSave = (settings: WebDavSettings | null) => invoke<void>("webdav_save", { settings });
export const webdavSync = () => invoke<WebDavReport>("webdav_sync");

export function describeReport(r: WebDavReport) {
  const parts = [
    r.uploaded && `${r.uploaded} subidos`,
    r.downloaded && `${r.downloaded} bajados`,
    r.deleted && `${r.deleted} borrados`,
  ].filter(Boolean);
  const base = parts.length ? `WebDAV: ${parts.join(", ")}.` : "WebDAV: todo al día.";
  return r.conflicts.length
    ? `${base} ${r.conflicts.length} ${r.conflicts.length === 1 ? "nota cambió" : "notas cambiaron"} en los dos sitios: revisa «Conflictos».`
    : base;
}
