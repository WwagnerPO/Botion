import DOMPurify from "dompurify";
import { marked } from "marked";
import { useEffect, useState } from "react";
import { splitFrontmatter } from "../lib/frontmatter";
import { isDatabaseEmbed } from "../lib/embed";
import { valueText, type Database } from "../lib/database";
import { Pill, formatDate } from "./PropertyInput";

/** Lo que una incrustación necesita de la app. */
export interface EmbedHost {
  /** Ruta de la nota a la que apunta el destino, o `null`. */
  resolve: (target: string) => Promise<string | null>;
  readNote: (path: string) => Promise<string>;
  getDatabase: (path: string) => Promise<Database>;
  open: (path: string, kind: "note" | "database") => void;
}

/** Markdown de una nota → HTML seguro, con los extras de Botion básicos. */
function toHtml(markdown: string) {
  const prepared = markdown
    .replace(/!\[\[([^\]]+)\]\]/g, "↳ $1")
    .replace(/\[\[([^\]|#]*)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, t, alias) => `**${alias ?? t}**`)
    .replace(/==([^=\n]+)==/g, "<mark>$1</mark>")
    .replace(/^> \[!(\w+)\][+-]? ?(.*)$/gm, (_, type, title) => `> **${title || type}**`);
  return DOMPurify.sanitize(marked.parse(prepared, { async: false }) as string);
}

export function Embed({ target, host }: { target: string; host: EmbedHost }) {
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
      <span>{label}</span>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={open}>
        Abrir ↗
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
  const columns = db.columns.slice(0, 5);
  const rows = db.rows.slice(0, 20);
  return (
    <div className="embed-box">
      {header(`${db.name} · ${db.rows.length} ${db.rows.length === 1 ? "nota" : "notas"}`, () =>
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
                  const v = r.props[c.name];
                  return (
                    <td key={c.name}>
                      {c.kind === "select" || c.kind === "tags"
                        ? (Array.isArray(v) ? v : valueText(v) ? [String(v)] : []).map((t) => (
                            <Pill key={t} text={t} />
                          ))
                        : c.kind === "checkbox"
                          ? v === true
                            ? "✓"
                            : ""
                          : c.kind === "date"
                            ? formatDate(valueText(v))
                            : valueText(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {db.rows.length > rows.length && (
          <p className="embed-muted">Y {db.rows.length - rows.length} más…</p>
        )}
      </div>
    </div>
  );
}
