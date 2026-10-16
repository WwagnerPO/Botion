import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { Editor } from "./components/Editor";
import { Sidebar } from "./components/Sidebar";
import { Autosaver, type SaveStatus } from "./lib/autosave";
import { joinFrontmatter, splitFrontmatter } from "./lib/frontmatter";
import {
  getLastVault,
  openVault,
  pickVaultFolder,
  readNote,
  setLastVault,
  type Vault,
} from "./lib/vault";

interface Note {
  path: string;
  frontmatter: string;
  body: string;
}

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: "",
  saving: "Guardando…",
  saved: "Guardado",
  error: "Error al guardar",
};

export default function App() {
  const [vault, setVault] = useState<Vault | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const [autosaver] = useState(
    () =>
      new Autosaver((s, err) => {
        setStatus(s);
        if (err) setError(err);
      }),
  );
  const noteRef = useRef(note);
  noteRef.current = note;

  const loadVault = useCallback(
    async (path: string) => {
      await autosaver.flush();
      try {
        const v = await openVault(path);
        setVault(v);
        setNote(null);
        setError(null);
        setLastVault(v.root);
      } catch (e) {
        setError(String(e));
        setLastVault(null);
      }
    },
    [autosaver],
  );

  useEffect(() => {
    const last = getLastVault();
    if (last) loadVault(last);
  }, [loadVault]);

  // Antes de cerrar la ventana, guarda lo que quede pendiente.
  useEffect(() => {
    const unlisten = getCurrentWindow().onCloseRequested(() =>
      autosaver.flush(),
    );
    return () => {
      unlisten.then((f) => f());
    };
  }, [autosaver]);

  async function handleOpenVault() {
    const path = await pickVaultFolder();
    if (path) await loadVault(path);
  }

  async function handleSelect(path: string) {
    if (path === note?.path) return;
    await autosaver.flush();
    try {
      const content = await readNote(path);
      setNote({ path, ...splitFrontmatter(content) });
      setStatus("idle");
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  const handleChange = useCallback(
    (body: string) => {
      const current = noteRef.current;
      if (!current) return;
      autosaver.schedule(
        current.path,
        joinFrontmatter(current.frontmatter, body),
      );
    },
    [autosaver],
  );

  return (
    <div className="flex h-full">
      <Sidebar
        vault={vault}
        selected={note?.path ?? null}
        onSelect={handleSelect}
        onOpenVault={handleOpenVault}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        {error && (
          <div
            role="alert"
            className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {error}
          </div>
        )}
        {note ? (
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl pt-10">
              <div className="mb-6 flex items-center justify-between px-14 text-xs text-neutral-400">
                <span className="truncate">{note.path}</span>
                <span aria-live="polite">{STATUS_TEXT[status]}</span>
              </div>
              <Editor
                key={note.path}
                initialValue={note.body}
                onChange={handleChange}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div>
              <h1 className="text-2xl font-semibold">Bienvenido a Botion</h1>
              <p className="mt-2 text-neutral-500">
                {vault
                  ? "Elige una nota en la barra lateral."
                  : "Abre una carpeta con notas Markdown para empezar."}
              </p>
              {!vault && (
                <button
                  type="button"
                  onClick={handleOpenVault}
                  className="mt-6 rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                >
                  Abrir carpeta
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
