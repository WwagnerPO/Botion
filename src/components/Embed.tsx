import { ExternalLink, FileText, Paperclip, Pencil, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { attachmentPath, fileKind } from "../lib/attachments";
import { splitFrontmatter } from "../lib/frontmatter";
import { toHtml } from "../lib/preview";
import { isDatabaseEmbed } from "../lib/embed";
import { activeView, type Database } from "../lib/database";
import { cell, rowTint, viewRows } from "../lib/dbview";
import { PAGE_KEYS } from "../lib/cover";
import { ChartView } from "./ChartView";
import { PdfViewer } from "./PdfViewer";
import { blockText, replaceBlock, sectionText, splitTarget } from "../lib/blockRefs";
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
  writeNote: (path: string, content: string) => Promise<void>;
  /** Bytes de un adjunto (PDF). */
  readFile: (path: string) => Promise<ArrayBuffer>;
  /** Crea una nota (`carpeta/Nombre`) y devuelve su ruta. */
  createNote: (target: string) => Promise<string>;
}

/** Vídeo, audio u otro fichero de la bóveda incrustado con `![[…]]`. */
function FileEmbed({ target, host }: { target: string; host: EmbedHost }) {
  const kind = fileKind(target)!;
  const path = attachmentPath(target);
  const name = path.split("/").pop()!;
  if (/\.pdf$/i.test(path)) return <PdfViewer path={path} host={host} />;
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
    | { kind: "block"; path: string; id: string; markdown: string }
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
        const content = await host.readNote(path);
        const { block, section } = splitTarget(target);
        // ![[Nota#^id]]: un bloque, que se puede editar desde aquí.
        if (block) {
          const markdown = blockText(content, block);
          if (current) setState(markdown === null ? { kind: "missing" } : { kind: "block", path, id: block, markdown });
          return;
        }
        const { body } = splitFrontmatter(content);
        const part = section ? sectionText(body, section) : body;
        if (current) setState(part === null ? { kind: "missing" } : { kind: "note", path, html: toHtml(part) });
      } catch {
        if (current) setState({ kind: "missing" });
      }
    })();
    return () => {
      current = false;
    };
  }, [target, host]);

  const name = target.replace(/\/+$/, "").split("/").pop();

  if (state.kind === "block") {
    return <BlockEmbed key={`${state.path}#${state.id}`} {...state} host={host} name={name ?? ""} />;
  }

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
    .filter((c) => !view.hidden.includes(c.name) && !PAGE_KEYS.has(c.name))
    .slice(0, 5);
  const rows = all.slice(0, 20);
  return (
    <div className="embed-box">
      {header(`${db.name} · ${view.name} · ${all.length} ${all.length === 1 ? "nota" : "notas"}`, () =>
        host.open(db.path, "database"),
      )}
      {view.kind === "chart" ? (
        <div className="embed-table">
          <ChartView view={view} rows={all} ctx={ctx} />
        </div>
      ) : (
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
              <tr key={r.path} data-tint={rowTint(r, view.colors, ctx) ?? undefined}>
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
      )}
    </div>
  );
}

/**
 * Bloque sincronizado (`![[Nota#^id]]`): se ve como en su nota y, al
 * editarlo aquí, se cambia en la nota original.
 */
function BlockEmbed({
  path,
  id,
  markdown,
  host,
  name,
}: {
  path: string;
  id: string;
  markdown: string;
  host: EmbedHost;
  name: string;
}) {
  const [text, setText] = useState(markdown);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const fresh = blockText(await host.readNote(path), id);
    if (fresh !== null) setText(fresh);
  }

  async function save(value: string) {
    setEditing(null);
    if (value === text) return;
    try {
      // Se lee otra vez por si la nota ha cambiado mientras tanto.
      const updated = replaceBlock(await host.readNote(path), id, value);
      if (updated === null) throw new Error("El bloque ya no está en la nota");
      await host.writeNote(path, updated);
      setText(value.replace(/\s+$/, ""));
      setError(null);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  return (
    <div className="embed-box embed-synced">
      <div className="embed-header" contentEditable={false}>
        <span className="embed-label">
          <RefreshCw className="size-3.5" />
          Sincronizado con {name.split("#")[0]}
        </span>
        <span className="flex gap-1">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => (reload(), setEditing(text))} title="Editar el bloque">
            <Pencil className="size-3" /> Editar
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => host.open(path, "note")}>
            Abrir <ExternalLink className="size-3" />
          </button>
        </span>
      </div>
      {editing !== null ? (
        <textarea
          autoFocus
          className="embed-edit"
          value={editing}
          aria-label="Texto del bloque sincronizado"
          rows={Math.max(2, editing.split("\n").length)}
          onChange={(e) => setEditing(e.target.value)}
          onBlur={(e) => save(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(null);
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.blur();
          }}
        />
      ) : (
        <div className="embed-body" onDoubleClick={() => setEditing(text)} dangerouslySetInnerHTML={{ __html: toHtml(text) }} />
      )}
      {error && <p className="embed-muted">{error}</p>}
    </div>
  );
}
