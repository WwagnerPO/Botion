import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export type TreeNode =
  | { kind: "folder"; name: string; path: string; children: TreeNode[] }
  | { kind: "note"; name: string; path: string };

export interface Vault {
  name: string;
  root: string;
  tree: TreeNode[];
}

const LAST_VAULT_KEY = "botion:last-vault";

export function openVault(path: string): Promise<Vault> {
  return invoke<Vault>("open_vault", { path });
}

export function readNote(path: string): Promise<string> {
  return invoke<string>("read_note", { path });
}

export function writeNote(path: string, content: string): Promise<void> {
  return invoke<void>("write_note", { path, content });
}

export interface Backlink {
  path: string;
  name: string;
  snippet: string;
}

/** Ruta de la nota a la que apunta `[[target]]` desde `from`, o `null`. */
export function resolveNoteLink(
  target: string,
  from: string,
): Promise<string | null> {
  return invoke<string | null>("resolve_note_link", { target, from });
}

export function getBacklinks(path: string): Promise<Backlink[]> {
  return invoke<Backlink[]>("get_backlinks", { path });
}

/** Crea la nota de un enlace que aún no existe y devuelve su ruta. */
export function createNote(target: string): Promise<string> {
  return invoke<string>("create_note", { target });
}

/** Muestra el selector de carpetas. Devuelve `null` si se cancela. */
export async function pickVaultFolder(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false });
  return typeof selected === "string" ? selected : null;
}

export function getLastVault(): string | null {
  try {
    return localStorage.getItem(LAST_VAULT_KEY);
  } catch {
    return null;
  }
}

export function setLastVault(path: string | null) {
  try {
    if (path) localStorage.setItem(LAST_VAULT_KEY, path);
    else localStorage.removeItem(LAST_VAULT_KEY);
  } catch {
    // Sin almacenamiento: simplemente no se recuerda la bóveda.
  }
}
