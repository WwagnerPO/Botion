import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
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
  content: string;
}

export default function App() {
  const [vault, setVault] = useState<Vault | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadVault = useCallback(async (path: string) => {
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
  }, []);

  useEffect(() => {
    const last = getLastVault();
    if (last) loadVault(last);
  }, [loadVault]);

  async function handleOpenVault() {
    const path = await pickVaultFolder();
    if (path) await loadVault(path);
  }

  async function handleSelect(path: string) {
    try {
      setNote({ path, content: await readNote(path) });
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

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
          <article className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-8 py-10">
            <p className="mb-6 text-xs text-neutral-400">{note.path}</p>
            <pre className="font-sans text-[15px] leading-relaxed whitespace-pre-wrap">
              {note.content}
            </pre>
          </article>
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
