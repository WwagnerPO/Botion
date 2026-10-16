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
