import { invoke } from "@tauri-apps/api/core";

export interface GitStatus {
  available: boolean;
  repo: boolean;
  branch: string | null;
  remote: string | null;
  changes: number;
  ahead: number;
  behind: number;
}

export interface SyncResult {
  committed: boolean;
  pulled: boolean;
  pushed: boolean;
  /** Notas que han cambiado al bajar cambios del remoto. */
  changed: string[];
  /** Notas que chocan con el remoto: hay que elegir cómo resolverlo. */
  conflicts: string[];
}

/** mine: gana lo de este ordenador; theirs: lo del remoto; both: la mía y una copia de la del remoto. */
export type Strategy = "mine" | "theirs" | "both";

export function gitResolve(strategy: Strategy): Promise<SyncResult> {
  return invoke<SyncResult>("git_resolve", { strategy });
}

export function gitStatus(): Promise<GitStatus> {
  return invoke<GitStatus>("git_status");
}

export function gitInit(): Promise<GitStatus> {
  return invoke<GitStatus>("git_init");
}

export function gitSync(): Promise<SyncResult> {
  return invoke<SyncResult>("git_sync");
}

const AUTO_KEY = "botion:git-auto:";

/** Sincronización automática activada para esta bóveda. */
export function getAutoSync(root: string): boolean {
  try {
    return localStorage.getItem(AUTO_KEY + root) === "1";
  } catch {
    return false;
  }
}

export function setAutoSync(root: string, on: boolean) {
  try {
    if (on) localStorage.setItem(AUTO_KEY + root, "1");
    else localStorage.removeItem(AUTO_KEY + root);
  } catch {
    // Sin almacenamiento: no se recuerda.
  }
}

/** Resumen corto del resultado, para el aviso. */
export function describeSync(r: SyncResult): string {
  const parts: string[] = [];
  if (r.committed) parts.push("cambios guardados");
  if (r.pulled) parts.push(`${r.changed.length} ${r.changed.length === 1 ? "fichero recibido" : "ficheros recibidos"}`);
  if (r.pushed) parts.push("subido al remoto");
  return parts.length ? `Sincronizado: ${parts.join(", ")}.` : "Todo estaba al día.";
}
