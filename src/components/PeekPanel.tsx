import { FileText, Maximize2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { COMPUTED_KINDS, type PropValue, type Row } from "../lib/database";
import { cell, type Ctx } from "../lib/dbview";
import { ICON_KEY } from "../lib/cover";
import { splitFrontmatter } from "../lib/frontmatter";
import { toHtml } from "../lib/preview";
import { readNote } from "../lib/vault";
import { ColumnIcon } from "./ColumnMenu";
import { CellView, PropertyInput } from "./PropertyInput";

interface Props {
  row: Row;
  ctx: Ctx;
  options: Record<string, string[]>;
  onClose: () => void;
  onOpenNote: (path: string) => void;
  onOpenLink: (target: string) => void;
  onChangeValue: (rowPath: string, column: string, value: PropValue) => void;
}

/**
 * Vista rápida de una fila sin salir de la base de datos: sus propiedades
 * (editables) y el texto de la nota.
 */
export function PeekPanel({ row, ctx, options, onClose, onOpenNote, onOpenLink, onChangeValue }: Props) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setHtml(null);
    readNote(row.path)
      .then((content) => current && setHtml(toHtml(splitFrontmatter(content).body)))
      .catch(() => current && setHtml(""));
    return () => {
      current = false;
    };
  }, [row.path, row.modified]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target as HTMLElement).closest("input, textarea, [data-popover]")) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const icon = row.props[ICON_KEY];
  return (
    <aside
      role="dialog"
      aria-label={`Vista rápida de ${row.name}`}
      className="fixed top-0 right-0 bottom-0 z-30 flex w-[min(560px,92vw)] animate-pop flex-col border-l border-neutral-200 bg-white shadow-pop dark:border-neutral-800 dark:bg-neutral-950"
    >
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-neutral-100 px-2 dark:border-neutral-800">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar vista rápida"
          className="grid size-7 place-items-center rounded-md text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <X className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onOpenNote(row.path)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          <Maximize2 className="size-3.5" /> Abrir como página
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-8 pt-8 pb-16">
        <div className="mb-2 text-5xl leading-none">
          {typeof icon === "string" ? icon : <FileText className="size-10 text-neutral-300 dark:text-neutral-600" strokeWidth={1.5} />}
        </div>
        <h2 className="mb-5 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">{row.name}</h2>
        {row.error ? (
          <p className="text-sm text-red-500">{row.error}</p>
        ) : (
          <div className="mb-6 space-y-0.5 border-b border-neutral-200 pb-4 dark:border-neutral-800">
            {ctx.db.columns.map((c) => {
              const computed = COMPUTED_KINDS.has(c.kind);
              const v = computed ? cell(row, c, ctx) : null;
              return (
                <div key={c.name} className="flex min-h-8 items-center gap-2 rounded-md text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <span className="flex w-36 shrink-0 items-center gap-2 truncate px-1.5 text-neutral-500" title={c.name}>
                    <ColumnIcon kind={c.kind} />
                    <span className="truncate">{c.name}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    {computed ? (
                      <CellView kind={c.kind} value={v!.value} error={v!.error} alignNumbers={false} onOpenLink={onOpenLink} />
                    ) : (
                      <PropertyInput
                        id={`peek-${row.path}-${c.name}`}
                        kind={c.kind}
                        value={row.props[c.name]}
                        options={options[c.name]}
                        notePath={row.path}
                        relation={c.relation}
                        onOpenLink={onOpenLink}
                        alignNumbers={false}
                        onChange={(value) => onChangeValue(row.path, c.name, value)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {html === null ? (
          <p className="text-sm text-neutral-400">Cargando…</p>
        ) : html.trim() ? (
          <div className="peek-body" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p className="text-sm text-neutral-400">Esta nota no tiene texto todavía.</p>
        )}
      </div>
    </aside>
  );
}
