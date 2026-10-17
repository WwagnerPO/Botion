import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { Backlinks } from "./components/Backlinks";
import { ContextMenu, type MenuItem } from "./components/ContextMenu";
import { Dialog, type DialogRequest } from "./components/Dialog";
import { Editor } from "./components/Editor";
import { SearchPalette } from "./components/SearchPalette";
import { Sidebar } from "./components/Sidebar";
import { Autosaver, type SaveStatus } from "./lib/autosave";
import { joinFrontmatter, splitFrontmatter } from "./lib/frontmatter";
import {
  createFolder,
  createNote,
  deleteEntry,
  getBacklinks,
  getLastVault,
  onVaultChanged,
  openVault,
  pickVaultFolder,
  readNote,
  refreshTree,
  renameEntry,
  resolveNoteLink,
  setLastVault,
  type Backlink,
  type TreeNode,
  type Vault,
} from "./lib/vault";

interface Note {
  path: string;
  frontmatter: string;
  body: string;
  /** Cambia al recargar la nota desde disco, para reiniciar el editor. */
  version: number;
}

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: "",
  saving: "Guardando…",
  saved: "Guardado",
  error: "Error al guardar",
};

/** `true` si `path` es `base` o está dentro de la carpeta `base`. */
function isInside(path: string, base: string) {
  return path === base || path.startsWith(base + "/");
}

export default function App() {
  const [vault, setVault] = useState<Vault | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    items: MenuItem[];
  } | null>(null);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [searching, setSearching] = useState(false);
  /** Comando «/Enlace a nota» esperando a que se elija una nota. */
  const [linkRequest, setLinkRequest] = useState<
    ((target: string) => void) | null
  >(null);

  const [autosaver] = useState(
    () =>
      new Autosaver((s, err) => {
        setStatus(s);
        if (err) setError(err);
      }),
  );
  const noteRef = useRef(note);
  noteRef.current = note;
  const closeMenu = useCallback(() => setMenu(null), []);
  const closeDialog = useCallback(() => setDialog(null), []);
  const closeSearch = useCallback(() => setSearching(false), []);
  const closeLinkPicker = useCallback(() => setLinkRequest(null), []);

  // Solo cuenta la última apertura si se piden varias seguidas.
  const loadRequest = useRef(0);
  const loadVault = useCallback(
    async (path: string) => {
      const request = ++loadRequest.current;
      await autosaver.flush();
      try {
        const v = await openVault(path);
        if (request !== loadRequest.current) return;
        setVault(v);
        setNote(null);
        setError(null);
        setLastVault(v.root);
      } catch (e) {
        if (request !== loadRequest.current) return;
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

  // Cambios hechos desde fuera de la app (otro editor, el explorador...).
  useEffect(() => {
    const unlisten = onVaultChanged((tree) =>
      setVault((v) => v && { ...v, tree }),
    );
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  async function reloadTree() {
    const tree = await refreshTree();
    setVault((v) => v && { ...v, tree });
  }

  async function handleOpenVault() {
    const path = await pickVaultFolder();
    if (path) await loadVault(path);
  }

  /** Abre una nota. Con `force` la vuelve a leer aunque ya esté abierta. */
  async function openNote(path: string, force = false) {
    if (!force && path === noteRef.current?.path) return;
    // Guarda antes de leer, para que los backlinks vean los últimos cambios.
    await autosaver.flush();
    try {
      const [content, links] = await Promise.all([
        readNote(path),
        getBacklinks(path),
      ]);
      setNote((prev) => ({
        path,
        ...splitFrontmatter(content),
        version: (prev?.version ?? 0) + 1,
      }));
      setBacklinks(links);
      setStatus("idle");
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  /** Abre la nota de un enlace `[[...]]`, creándola si aún no existe. */
  async function handleOpenLink(target: string) {
    if (!note) return;
    await autosaver.flush();
    try {
      let path = await resolveNoteLink(target, note.path);
      if (!path) {
        path = await createNote(target);
        await reloadTree();
      }
      await openNote(path);
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

  /** Ejecuta una acción sobre ficheros mostrando el error si falla. */
  async function run(action: () => Promise<void>) {
    try {
      setError(null);
      setNotice(null);
      await action();
    } catch (e) {
      setError(String(e));
    }
  }

  function newNote(folder = "") {
    setDialog({
      kind: "prompt",
      title: "Nueva nota",
      label: "Nombre",
      initial: "Sin título",
      confirm: "Crear",
      onConfirm: (name) =>
        run(async () => {
          const path = await createNote(folder ? `${folder}/${name}` : name);
          await reloadTree();
          await openNote(path);
        }),
    });
  }

  function newFolder(folder = "") {
    setDialog({
      kind: "prompt",
      title: "Nueva carpeta",
      label: "Nombre",
      initial: "Nueva carpeta",
      confirm: "Crear",
      onConfirm: (name) =>
        run(async () => {
          await createFolder(folder ? `${folder}/${name}` : name);
          await reloadTree();
        }),
    });
  }

  function rename(node: TreeNode) {
    setDialog({
      kind: "prompt",
      title: node.kind === "folder" ? "Renombrar carpeta" : "Renombrar nota",
      label: "Nuevo nombre",
      initial: node.name,
      confirm: "Renombrar",
      onConfirm: (name) =>
        run(async () => {
          await autosaver.flush();
          const result = await renameEntry(node.path, name);
          await reloadTree();
          const current = noteRef.current;
          if (current) {
            // La nota abierta puede haber cambiado de ruta o de enlaces.
            const path = isInside(current.path, node.path)
              ? result.path + current.path.slice(node.path.length)
              : current.path;
            await openNote(path, true);
          }
          if (result.updated_notes > 0) {
            setNotice(
              `Enlaces actualizados en ${result.updated_notes} ${
                result.updated_notes === 1 ? "nota" : "notas"
              }.`,
            );
          }
        }),
    });
  }

  function remove(node: TreeNode) {
    setDialog({
      kind: "confirm",
      title: node.kind === "folder" ? "Eliminar carpeta" : "Eliminar nota",
      message:
        node.kind === "folder"
          ? `«${node.name}» y todo su contenido irán a la papelera del sistema.`
          : `«${node.name}» irá a la papelera del sistema.`,
      confirm: "Mover a la papelera",
      danger: true,
      onConfirm: () =>
        run(async () => {
          await autosaver.flush();
          await deleteEntry(node.path);
          if (noteRef.current && isInside(noteRef.current.path, node.path)) {
            setNote(null);
          }
          await reloadTree();
        }),
    });
  }

  function handleContextMenu(node: TreeNode | null, e: React.MouseEvent) {
    e.preventDefault();
    const items: MenuItem[] =
      node === null
        ? [
            { label: "Nueva nota", onSelect: () => newNote() },
            { label: "Nueva carpeta", onSelect: () => newFolder() },
          ]
        : [
            ...(node.kind === "folder"
              ? [
                  {
                    label: "Nueva nota aquí",
                    onSelect: () => newNote(node.path),
                  },
                  {
                    label: "Nueva carpeta aquí",
                    onSelect: () => newFolder(node.path),
                  },
                ]
              : []),
            { label: "Renombrar", onSelect: () => rename(node) },
            { label: "Eliminar", onSelect: () => remove(node), danger: true },
          ];
    setMenu({ x: e.clientX, y: e.clientY, items });
  }

  /** Texto para enlazar a `path`: el nombre, o la ruta si hay otra igual. */
  function linkTarget(path: string) {
    const name = path.split("/").pop()!.replace(/\.md$/, "");
    const notes: string[] = [];
    const collect = (nodes: TreeNode[]) =>
      nodes.forEach((n) =>
        n.kind === "folder" ? collect(n.children) : notes.push(n.path),
      );
    collect(vault?.tree ?? []);
    const same = notes.filter(
      (p) =>
        p.split("/").pop()!.replace(/\.md$/, "").toLowerCase() ===
        name.toLowerCase(),
    );
    return same.length > 1 ? path.replace(/\.md$/, "") : name;
  }

  /** Crea una nota en la raíz desde la búsqueda y la abre. */
  function createFromSearch(name: string) {
    run(async () => {
      const path = await createNote(name);
      await reloadTree();
      await openNote(path);
    });
  }

  // Atajos: Ctrl/Cmd + N nueva nota; Ctrl/Cmd + K o P buscar.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || !vault) return;
      const key = e.key.toLowerCase();
      if (key === "n") {
        e.preventDefault();
        newNote();
      } else if (key === "k" || key === "p") {
        e.preventDefault();
        setSearching(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex h-full">
      <Sidebar
        vault={vault}
        selected={note?.path ?? null}
        onSelect={(path) => openNote(path)}
        onOpenVault={handleOpenVault}
        onNewNote={() => newNote()}
        onNewFolder={() => newFolder()}
        onSearch={() => setSearching(true)}
        onContextMenu={handleContextMenu}
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
        {notice && (
          <div
            role="status"
            className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
          >
            {notice}
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-100"
              aria-label="Cerrar aviso"
            >
              ✕
            </button>
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
                key={`${note.path}#${note.version}`}
                initialValue={note.body}
                onChange={handleChange}
                onOpenLink={handleOpenLink}
                onRequestLink={(insert) => setLinkRequest(() => insert)}
              />
              <Backlinks
                backlinks={backlinks}
                onSelect={(path) => openNote(path)}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div>
              <h1 className="text-2xl font-semibold">Bienvenido a Botion</h1>
              <p className="mt-2 text-neutral-500">
                {vault
                  ? "Elige una nota en la barra lateral o crea una nueva."
                  : "Abre una carpeta con notas Markdown para empezar."}
              </p>
              <button
                type="button"
                onClick={vault ? () => newNote() : handleOpenVault}
                className="mt-6 rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
              >
                {vault ? "Nueva nota" : "Abrir carpeta"}
              </button>
            </div>
          </div>
        )}
      </main>
      {menu && <ContextMenu {...menu} onClose={closeMenu} />}
      {dialog && <Dialog request={dialog} onClose={closeDialog} />}
      {linkRequest && (
        <SearchPalette
          placeholder="Enlazar a una nota…"
          onOpen={(path) => linkRequest(linkTarget(path))}
          onCreate={(name) =>
            run(async () => {
              await createNote(name);
              await reloadTree();
              linkRequest(name);
            })
          }
          onClose={closeLinkPicker}
        />
      )}
      {searching && (
        <SearchPalette
          onOpen={(path) => openNote(path)}
          onCreate={createFromSearch}
          onClose={closeSearch}
        />
      )}
    </div>
  );
}
