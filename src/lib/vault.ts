import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

export type TreeNode =
  | {
      kind: "folder";
      name: string;
      path: string;
      /** La carpeta es una base de datos (se abre como tabla). */
      database: boolean;
      children: TreeNode[];
    }
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

export interface SearchHit {
  path: string;
  name: string;
  /** Fragmento con las coincidencias entre `\u0002` y `\u0003`. */
  snippet: string;
}

/** Busca en títulos y texto. Sin consulta, devuelve las notas recientes. */
export function searchNotes(query: string): Promise<SearchHit[]> {
  return invoke<SearchHit[]>("search_notes", { query });
}

export function getBacklinks(path: string): Promise<Backlink[]> {
  return invoke<Backlink[]>("get_backlinks", { path });
}

/** Crea una nota (por ejemplo `Proyectos/Plan`) y devuelve su ruta. */
export function createNote(target: string): Promise<string> {
  return invoke<string>("create_note", { target });
}

export function createFolder(path: string): Promise<string> {
  return invoke<string>("create_folder", { path });
}

export interface Renamed {
  path: string;
  updated_notes: number;
}

/** Renombra una nota o carpeta y actualiza los enlaces que apuntan a ella. */
export function renameEntry(path: string, newName: string): Promise<Renamed> {
  return invoke<Renamed>("rename_entry", { path, newName });
}

/** Mueve una nota o carpeta a la papelera del sistema. */
export function deleteEntry(path: string): Promise<void> {
  return invoke<void>("delete_entry", { path });
}

export function refreshTree(): Promise<TreeNode[]> {
  return invoke<TreeNode[]>("refresh_tree");
}

/** Avisa cuando cambian las notas desde fuera de la app. */
export function onVaultChanged(handler: (tree: TreeNode[]) => void) {
  return listen<TreeNode[]>("vault-changed", (e) => handler(e.payload));
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
