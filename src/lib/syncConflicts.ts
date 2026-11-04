/**
 * Copias en conflicto que dejan los programas de sincronización cuando una
 * nota cambia en dos sitios a la vez: Syncthing, Dropbox, Nextcloud, Botion
 * con WebDAV («(conflicto WebDAV)») o Git («(remoto)»).
 */

export interface SyncConflict {
  /** La copia que hay que resolver. */
  copy: string;
  /** La nota original (puede no existir). */
  original: string;
  source: string;
}

const PATTERNS: { re: RegExp; source: string }[] = [
  { re: /^(.*)\.sync-conflict-\d{8}-\d{6}-[A-Z0-9]+(\.md)$/i, source: "Syncthing" },
  { re: /^(.*?) \(conflicto WebDAV(?: \d+)?\)(\.md)$/i, source: "WebDAV" },
  { re: /^(.*?) \(remoto\)(\.md)$/i, source: "Git" },
  // Dropbox, Nextcloud, OneDrive…: «nota (conflicted copy 2026-11-04)», «nota (copia en conflicto de …)».
  { re: /^(.*?) \((?=[^()]*conflict)[^()]*\)(\.md)$/i, source: "la nube" },
];

export function findConflicts(paths: string[]): SyncConflict[] {
  const out: SyncConflict[] = [];
  for (const copy of paths) {
    for (const { re, source } of PATTERNS) {
      const m = re.exec(copy);
      if (m) {
        out.push({ copy, original: m[1] + m[2], source });
        break;
      }
    }
  }
  return out;
}

/** Nombre para guardar las dos versiones: «nota (otra versión)». */
export function keepBothName(original: string) {
  return original.split("/").pop()!.replace(/\.md$/i, "") + " (otra versión)";
}
