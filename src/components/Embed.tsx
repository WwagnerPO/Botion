import { ExternalLink, FileText, Paperclip } from "lucide-react";
import { useEffect, useState } from "react";
import { attachmentPath, fileKind } from "../lib/attachments";
import { splitFrontmatter } from "../lib/frontmatter";
import { toHtml } from "../lib/preview";
import { isDatabaseEmbed } from "../lib/embed";
import { activeView, type Database } from "../lib/database";
import { cell, viewRows } from "../lib/dbview";
import { CellView } from "./PropertyInput";

/** Lo que una incrustación necesita de la app. */
export interface EmbedHost {
  /** Ruta de la nota a la que apunta el destino, o `null`. */
  resolve: (target: string) => Promise<string | null>;
  readNote: (path: string) => Promise<string>;
  getDatabase: (path: string) => Promise<Database>;
  open: (path: string, kind: "note" | "database") => void;
  /** URL para mostrar un adjunto de la bóveda (vídeo, audio). */
  fileUrl: (path: string) => string;
  /** Abre un adjunto con el programa del sistema. */
  openFile: (path: string) => void;
}

/** Vídeo, audio u otro fichero de la bóveda incrustado con `![[…]]`. */
function FileEmbed({ target, host }: { target: string; host: EmbedHost }) {
  const kind = fileKind(target)!;
  const path = attachmentPath(target);
  const name = path.split("/").pop()!;
  if (kind === "video") {
    return (
      <div className="embed-media">
        <video controls preload="metadata" src={host.fileUrl(path)} />
      </div>
    );
  }
  if (kind === "audio") {
    return (
      <div className="embed-media">
        <audio controls preload="metadata" src={host.fileUrl(path)} />
        <span className="embed-muted">{name}</span>
      </div>
    );
  }
  return (
    <div className="embed-file" contentEditable={false}>
      <Paperclip className="size-4 shrink-0" />
      <span className="embed-file-name">{name}</span>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => host.openFile(path)}>
        <ExternalLink className="size-3.5" /> Abrir
      </button>
    </div>
  );
}

export function Embed({ target, host }: { target: string; host: EmbedHost }) {
  if (fileKind(target)) return <FileEmbed target={target} host={host} />;
  return <NoteEmbed target={target} host={host} />;
}

function NoteEmbed({ target, host }: { target: string; host: EmbedHost }) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "missing" }
    | { kind: "note"; path: string; html: string }
    | { kind: "database"; db: Database }
  >({ kind: "loading" });

  useEffect(() => {
    let current = true;
    (async () => {
      try {
        if (isDatabaseEmbed(target)) {
          const db = await host.getDatabase(target.replace(/\/+$/, ""));
          if (current) setState({ kind: "database", db });
          return;
        }
        const path = await host.resolve(target);
        if (!path) {
          if (current) setState({ kind: "missing" });
          return;
        }
        const { body } = splitFrontmatter(await host.readNote(path));
        if (current) setState({ kind: "note", path, html: toHtml(body) });
      } catch {
        if (current) setState({ kind: "missing" });
      }
    })();
    return () => {
      current = false;
    };
  }, [target, host]);

  const name = target.replace(/\/+$/, "").split("/").pop();

  if (state.kind === "loading") {
    return <div className="embed-box embed-muted">Cargando «{name}»…</div>;
  }
  if (state.kind === "missing") {
    return <div className="embed-box embed-muted">No existe «{name}».</div>;
  }

  const header = (label: string, open: () => void) => (
    <div className="embed-header" contentEditable={false}>
      <span className="embed-label">
        <FileText className="size-3.5" />
        {label}
      </span>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={open}>
        Abrir <ExternalLink className="size-3" />
      </button>
    </div>
  );

  if (state.kind === "note") {
    return (
      <div className="embed-box">
        {header(name ?? "", () => host.open(state.path, "note"))}
        <div className="embed-body" dangerouslySetInnerHTML={{ __html: state.html }} />
      </div>
    );
  }

  const { db } = state;
  // La vista abierta de la base de datos: sus filtros, orden y columnas.
  const view = activeView(db);
  const ctx = { db, related: {} };
  const all = viewRows(view, ctx);
  const columns = db.columns
    .filter((c) => !view.hidden.includes(c.name) && c.name !== "icono" && c.name !== "portada")
    .slice(0, 5);
  const rows = all.slice(0, 20);
  return (
    <div className="embed-box">
      {header(`${db.name} · ${view.name} · ${all.length} ${all.length === 1 ? "nota" : "notas"}`, () =>
        host.open(db.path, "database"),
      )}
      <div className="embed-table">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              {columns.map((c) => (
                <th key={c.name}>{c.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.path}>
                <td>
                  <button type="button" onClick={() => host.open(r.path, "note")}>
                    {r.name}
                  </button>
                </td>
                {columns.map((c) => {
                  const v = cell(r, c, ctx);
                  return (
                    <td key={c.name}>
                      <CellView kind={c.kind} value={v.value} error={v.error} alignNumbers={false} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {all.length > rows.length && (
          <p className="embed-muted">Y {all.length - rows.length} más…</p>
        )}
      </div>
    </div>
  );
}
