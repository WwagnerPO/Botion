import { ArrowLeftToLine, FileText, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { joinFrontmatter, splitFrontmatter } from "../lib/frontmatter";
import { readNote, writeNote } from "../lib/vault";
import { Editor, type EditorProps } from "./Editor";

type Shared = Omit<EditorProps, "initialValue" | "onChange" | "notePath" | "findOpen" | "onCloseFind">;

interface Props {
  path: string;
  icon?: string;
  editorProps: Shared;
  onClose: () => void;
  /** Abrir esta nota en el panel principal. */
  onOpenMain: (path: string) => void;
  onError: (message: string) => void;
}

/**
 * Segunda nota a la derecha, para verlas lado a lado. Tiene su propio
 * guardado automático; las propiedades se editan en el panel principal.
 */
export function SplitPane({ path, icon, editorProps, onClose, onOpenMain, onError }: Props) {
  const [note, setNote] = useState<{ frontmatter: string; body: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef<{ body: string; timer: number } | null>(null);
  const frontmatter = useRef("");

  useEffect(() => {
    let current = true;
    setNote(null);
    readNote(path)
      .then((content) => {
        if (!current) return;
        const parts = splitFrontmatter(content);
        frontmatter.current = parts.frontmatter;
        setNote(parts);
      })
      .catch((e) => onError(String(e)));
    return () => {
      current = false;
    };
  }, [path, onError]);

  const flush = async () => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    window.clearTimeout(p.timer);
    try {
      await writeNote(path, joinFrontmatter(frontmatter.current, p.body));
    } catch (e) {
      onError(String(e));
    } finally {
      setSaving(false);
    }
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  // Al cerrar el panel o cambiar de nota se guarda lo que quede.
  useEffect(() => () => void flushRef.current(), [path]);

  const name = path.split("/").pop()!.replace(/\.md$/i, "");
  return (
    <section aria-label={`Panel derecho: ${name}`} className="flex min-w-0 flex-1 flex-col border-l border-neutral-200 dark:border-neutral-800">
      <div className="no-print flex h-11 shrink-0 items-center gap-2 px-3 text-sm">
        {icon ? <span>{icon}</span> : <FileText className="size-4 shrink-0 text-neutral-400" strokeWidth={1.75} />}
        <span className="min-w-0 flex-1 truncate text-neutral-800 dark:text-neutral-100">{name}</span>
        <span className="text-xs text-neutral-400">{saving ? "Guardando…" : ""}</span>
        <button
          type="button"
          onClick={async () => {
            await flush();
            onOpenMain(path);
          }}
          title="Abrir en el panel principal"
          aria-label="Abrir en el panel principal"
          className="grid size-7 place-items-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
        >
          <ArrowLeftToLine className="size-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          title="Cerrar panel"
          aria-label="Cerrar panel derecho"
          className="grid size-7 place-items-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pt-6">
        {note && (
          <Editor
            key={path}
            {...editorProps}
            initialValue={note.body}
            notePath={path}
            findOpen={false}
            onCloseFind={() => {}}
            onChange={(body) => {
              setSaving(true);
              if (pending.current) window.clearTimeout(pending.current.timer);
              pending.current = { body, timer: window.setTimeout(() => void flushRef.current(), 600) };
            }}
          />
        )}
      </div>
    </section>
  );
}
