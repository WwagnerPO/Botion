import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  CircleAlert,
  FolderOpen,
  Info,
  LayoutTemplate,
  Search,
  SquarePen,
  Table2,
  X,
  Zap,
} from "lucide-react";
import logo from "./assets/logo.png";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Backlinks } from "./components/Backlinks";
import { ContextMenu, type MenuItem } from "./components/ContextMenu";
import { DatabaseView } from "./components/DatabaseView";
import { Dialog, type DialogRequest } from "./components/Dialog";
import { Editor } from "./components/Editor";
import { GitPanel } from "./components/GitPanel";
import { NoteTopBar } from "./components/NoteTopBar";
import { PageHeader } from "./components/PageHeader";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { SearchPalette } from "./components/SearchPalette";
import { Sidebar } from "./components/Sidebar";
import { Autosaver, type SaveStatus } from "./lib/autosave";
import { linkChecker } from "./lib/wikilink";
import { applyTheme } from "./lib/theme";
import {
  displayUrl,
  openInSystem,
  pickFile,
  revealInSystem,
  saveAttachment,
} from "./lib/attachments";
import { COVERS, COVER_KEY, ICON_KEY } from "./lib/cover";
import { noteToHtml, printNote, saveHtml } from "./lib/export";
import type { SyncResult } from "./lib/git";
import {
  columnOptions,
  createDatabase,
  getDatabase,
  getProperties,
  setProperty,
  type Kind,
  type PropValue,
  type Props,
} from "./lib/database";
import { joinFrontmatter, splitFrontmatter } from "./lib/frontmatter";
import {
  EXAMPLE_TEMPLATE,
  TEMPLATES_FOLDER,
  applyVariables,
  listTemplates,
} from "./lib/templates";
import {
  createFolder,
  createNote,
  deleteEntry,
  getBacklinks,
  getLastVault,
  moveEntry,
  onNotesChanged,
  onVaultChanged,
  openVault,
  pickVaultFolder,
  readNote,
  refreshTree,
  renameEntry,
  resolveNoteLink,
  setLastVault,
  writeNote,
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

/** Carpeta del árbol con esa ruta. */
function findFolder(nodes: TreeNode[], path: string): Extract<TreeNode, { kind: "folder" }> | null {
  for (const n of nodes) {
    if (n.kind !== "folder") continue;
    if (n.path === path) return n;
    if (path.startsWith(n.path + "/")) return findFolder(n.children, path);
  }
  return null;
}

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
  const [props, setProps] = useState<Props>({});
  /** Tipos y valores de la base de datos de la nota abierta, si está en una. */
  const [propKinds, setPropKinds] = useState<Record<string, Kind>>({});
  const [propOptions, setPropOptions] = useState<Record<string, string[]>>({});
  const [propRelations, setPropRelations] = useState<Record<string, string>>({});
  /** Carpeta de base de datos abierta (en lugar de una nota). */
  const [database, setDatabase] = useState<string | null>(null);
  /** Sube para que la tabla abierta se vuelva a leer del disco. */
  const [dbReloadKey, setDbReloadKey] = useState(0);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    items: MenuItem[];
  } | null>(null);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [searching, setSearching] = useState(false);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  /** Comando «/Enlace a nota» esperando a que se elija una nota. */
  const [linkRequest, setLinkRequest] = useState<
    ((target: string) => void) | null
  >(null);

  // Qué enlaces [[...]] apuntan a notas que existen, según el árbol.
  const linkExists = useMemo(() => {
    const paths: string[] = [];
    const walk = (nodes: TreeNode[]) =>
      nodes.forEach((n) => (n.kind === "folder" ? walk(n.children) : paths.push(n.path)));
    walk(vault?.tree ?? []);
    return linkChecker(paths);
  }, [vault?.tree]);

  /** Momento de la última edición en el editor (Milkdown avisa con retraso). */
  const lastEditAt = useRef(0);
  const markEdit = useCallback(() => {
    lastEditAt.current = Date.now();
  }, []);

  /** Último contenido de la nota abierta que la app leyó o escribió. */
  const knownContent = useRef<{ path: string; content: string } | null>(null);
  const [autosaver] = useState(
    () =>
      new Autosaver(
        (s, err) => {
          setStatus(s);
          if (err) setError(err);
        },
        (path, content) => {
          knownContent.current = { path, content };
        },
      ),
  );
  const noteRef = useRef(note);
  noteRef.current = note;
  const closeMenu = useCallback(() => setMenu(null), []);
  const closeDialog = useCallback(() => setDialog(null), []);
  const closeSearch = useCallback(() => setSearching(false), []);
  const closeLinkPicker = useCallback(() => setLinkRequest(null), []);
  /** Elección de plantilla pendiente: insertar en la nota o crear una nueva. */
  const [templateRequest, setTemplateRequest] = useState<
    | { mode: "insert"; insert: (markdown: string) => void }
    | { mode: "new"; folder: string }
    | null
  >(null);
  const closeTemplatePicker = useCallback(() => setTemplateRequest(null), []);
  /** Comando «/Vista de base de datos» esperando a que se elija una. */
  const [dbPicker, setDbPicker] = useState<((folder: string) => void) | null>(null);
  const closeDbPicker = useCallback(() => setDbPicker(null), []);
  const showError = useCallback((message: string) => setError(message), []);
  const showMenu = useCallback(
    (x: number, y: number, items: MenuItem[]) => setMenu({ x, y, items }),
    [],
  );

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
        setDatabase(null);
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

  // Si la nota abierta cambia desde fuera (otro editor, Git...), se recarga.
  // Si además hay cambios sin guardar, se mantienen los de Botion.
  const reloadIfChanged = useRef<(paths: string[]) => void>(() => {});
  reloadIfChanged.current = async (paths) => {
    const current = noteRef.current;
    if (!current || !paths.includes(current.path)) return;
    let disk: string;
    try {
      disk = await readNote(current.path);
    } catch {
      return; // Borrada o movida: el árbol ya lo refleja.
    }
    const known = knownContent.current;
    if (known?.path === current.path && known.content === disk) return;
    const editingNow = Date.now() - lastEditAt.current < 2000;
    if (autosaver.hasPending(current.path) || editingNow) {
      setNotice("La nota ha cambiado fuera de Botion; se mantienen tus cambios.");
      return;
    }
    await openNote(current.path, true);
    setNotice("La nota se ha actualizado con cambios hechos fuera de Botion.");
  };
  useEffect(() => {
    const unlisten = onNotesChanged((paths) => reloadIfChanged.current(paths));
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  // Cambios hechos desde fuera de la app (otro editor, el explorador...).
  useEffect(() => {
    const unlisten = onVaultChanged((tree) => {
      setVault((v) => v && { ...v, tree });
      setDbReloadKey((k) => k + 1);
    });
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
      const [content, links, noteProps] = await Promise.all([
        readNote(path),
        getBacklinks(path),
        // Si el frontmatter no es válido, la nota se abre sin propiedades.
        getProperties(path).catch(() => ({})),
      ]);
      knownContent.current = { path, content };
      setNote((prev) => ({
        path,
        ...splitFrontmatter(content),
        version: (prev?.version ?? 0) + 1,
      }));
      setBacklinks(links);
      setProps(noteProps);
      setDatabase(null);
      loadNoteDatabase(path);
      setStatus("idle");
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  /** Si la nota está en una base de datos, usa sus tipos de columna. */
  async function loadNoteDatabase(path: string) {
    const folder = path.split("/").slice(0, -1).join("/");
    const isDatabase = (nodes: TreeNode[]): boolean =>
      nodes.some(
        (n) =>
          n.kind === "folder" &&
          (n.path === folder ? n.database : isDatabase(n.children)),
      );
    if (!folder || !isDatabase(vault?.tree ?? [])) {
      setPropKinds({});
      setPropOptions({});
      setPropRelations({});
      return;
    }
    try {
      const db = await getDatabase(folder);
      setPropKinds(Object.fromEntries(db.columns.map((c) => [c.name, c.kind])));
      setPropOptions(columnOptions(db));
      setPropRelations(
        Object.fromEntries(db.columns.filter((c) => c.relation).map((c) => [c.name, c.relation!])),
      );
    } catch {
      setPropKinds({});
      setPropOptions({});
    }
  }

  async function openDatabase(path: string) {
    await autosaver.flush();
    setNote(null);
    setDatabase(path);
    setError(null);
  }

  /** Cambia una propiedad de la nota abierta (`null` la quita). */
  async function changeProperty(key: string, value: PropValue, refreshTree = false) {
    const current = noteRef.current;
    if (!current) return;
    await run(async () => {
      // Primero se guarda el texto pendiente, para no pisar el cambio.
      await autosaver.flush();
      await setProperty(current.path, key, value);
      const [content, noteProps] = await Promise.all([
        readNote(current.path),
        getProperties(current.path),
      ]);
      knownContent.current = { path: current.path, content };
      // El editor sigue igual: solo cambia el frontmatter que se guardará.
      setNote((n) =>
        n && n.path === current.path
          ? { ...n, frontmatter: splitFrontmatter(content).frontmatter }
          : n,
      );
      setProps(noteProps);
      // El icono también se ve en el árbol.
      if (refreshTree) await reloadTree();
    });
  }

  /** Comando «/Propiedad»: añade una propiedad vacía a la nota. */
  function addProperty() {
    setDialog({
      kind: "prompt",
      title: "Nueva propiedad",
      label: "Nombre",
      initial: "",
      confirm: "Añadir",
      onConfirm: (name) => {
        if (name in props) {
          setError(`La nota ya tiene la propiedad «${name}»`);
          return;
        }
        return changeProperty(name, "");
      },
    });
  }

  /** Comando «/Base de datos»: crea una junto a la nota y la abre. */
  function createDatabaseHere(folder = "") {
    setDialog({
      kind: "prompt",
      title: "Nueva base de datos",
      label: "Nombre",
      initial: "Sin título",
      confirm: "Crear",
      onConfirm: (name) =>
        run(async () => {
          const path = await createDatabase(folder ? `${folder}/${name}` : name);
          await reloadTree();
          await openDatabase(path);
        }),
    });
  }

  /**
   * Abre el selector de plantillas. Si no hay ninguna, ofrece crear la
   * carpeta de plantillas con una de ejemplo.
   */
  function chooseTemplate(
    request: NonNullable<typeof templateRequest>,
  ) {
    if (listTemplates(vault?.tree ?? []).length > 0) {
      setTemplateRequest(request);
      return;
    }
    setDialog({
      kind: "confirm",
      title: "Aún no hay plantillas",
      message: `Las plantillas son notas de la carpeta «${TEMPLATES_FOLDER}». ¿Crearla con una plantilla de ejemplo («${EXAMPLE_TEMPLATE.name}»)?`,
      confirm: "Crear",
      onConfirm: () =>
        run(async () => {
          const path = await createNote(`${TEMPLATES_FOLDER}/${EXAMPLE_TEMPLATE.name}`);
          await writeNote(path, EXAMPLE_TEMPLATE.content);
          await reloadTree();
          setTemplateRequest(request);
        }),
    });
  }

  /** Inserta una plantilla en la nota abierta y añade sus propiedades. */
  async function insertTemplate(templatePath: string, insert: (md: string) => void) {
    const current = noteRef.current;
    if (!current) return;
    await run(async () => {
      const title = current.path.split("/").pop()!.replace(/\.md$/, "");
      const content = applyVariables(await readNote(templatePath), { title });
      insert(splitFrontmatter(content).body);
      // Solo las propiedades que la nota aún no tiene.
      const templateProps = await getProperties(templatePath).catch(() => ({}));
      for (const [key, value] of Object.entries(templateProps)) {
        if (key in props) continue;
        await changeProperty(
          key,
          typeof value === "string" ? applyVariables(value, { title }) : value,
        );
      }
    });
  }

  /** Crea una nota nueva a partir de una plantilla. */
  function newNoteFromTemplate(templatePath: string, folder: string) {
    setDialog({
      kind: "prompt",
      title: "Nueva nota desde plantilla",
      label: "Nombre",
      initial: "Sin título",
      confirm: "Crear",
      onConfirm: (name) =>
        run(async () => {
          const template = await readNote(templatePath);
          const path = await createNote(folder ? `${folder}/${name}` : name);
          await writeNote(path, applyVariables(template, { title: name }));
          await reloadTree();
          await openNote(path);
        }),
    });
  }

  const beforeSync = useCallback(() => autosaver.flush(), [autosaver]);

  /** Tras sincronizar: recarga lo que haya cambiado al bajar del remoto. */
  async function handleSynced(result: SyncResult, message: string) {
    setError(null);
    setNotice(message);
    if (!result.pulled) return;
    await reloadTree();
    setDbReloadKey((k) => k + 1);
    const current = noteRef.current;
    if (current && result.changed.includes(current.path)) {
      await openNote(current.path, true);
    }
  }

  // Lo que necesitan las incrustaciones ![[...]] del editor. Usa la nota
  // abierta en el momento de cada llamada.
  const openNoteRef = useRef(openNote);
  openNoteRef.current = openNote;
  const openDatabaseRef = useRef(openDatabase);
  const vaultRootRef = useRef("");
  vaultRootRef.current = vault?.root ?? "";
  openDatabaseRef.current = openDatabase;
  const embedHost = useMemo(
    () => ({
      resolve: (target: string) =>
        resolveNoteLink(target, noteRef.current?.path ?? ""),
      readNote,
      getDatabase,
      open: (path: string, kind: "note" | "database") =>
        kind === "note" ? openNoteRef.current(path) : openDatabaseRef.current(path),
      fileUrl: (path: string) => displayUrl(path, vaultRootRef.current, ""),
      openFile: (path: string) => openInSystem(path).catch((e) => showError(String(e))),
    }),
    [],
  );

  /** Bases de datos de la bóveda, para elegir una. */
  function listDatabases() {
    const out: { path: string; name: string }[] = [];
    const walk = (nodes: TreeNode[]) =>
      nodes.forEach((n) => {
        if (n.kind !== "folder") return;
        if (n.database) out.push({ path: n.path, name: n.name });
        walk(n.children);
      });
    walk(vault?.tree ?? []);
    return out;
  }

  /** Exporta la nota abierta a HTML (un fichero) o a PDF (imprimir). */
  async function exportNote(format: "html" | "pdf") {
    const current = noteRef.current;
    if (!current || !vault) return;
    await autosaver.flush();
    if (format === "pdf") {
      await printNote();
      return;
    }
    await run(async () => {
      const name = current.path.split("/").pop()!.replace(/\.md$/, "");
      const html = await noteToHtml(name, await readNote(current.path), props, (src) =>
        displayUrl(src, vault.root, current.path),
      );
      const saved = await saveHtml(name, html);
      if (saved) setNotice(`Exportada a ${saved}`);
    });
  }

  /** Comando «/Página»: crea una nota junto a la abierta y la enlaza. */
  function requestPage(insert: (target: string) => void) {
    const folder = noteRef.current?.path.split("/").slice(0, -1).join("/") ?? "";
    setDialog({
      kind: "prompt",
      title: "Nueva página",
      label: "Nombre",
      initial: "Sin título",
      confirm: "Crear",
      onConfirm: (name) =>
        run(async () => {
          const path = await createNote(folder ? `${folder}/${name}` : name);
          await reloadTree();
          insert(linkTarget(path));
        }),
    });
  }

  /** Nueva fila (nota) en una base de datos, sin salir de la tabla. */
  function newRow(folder: string, preset: Props = {}) {
    setDialog({
      kind: "prompt",
      title: "Nueva fila",
      label: "Nombre de la nota",
      initial: "Sin título",
      confirm: "Crear",
      onConfirm: (name) =>
        run(async () => {
          const path = await createNote(`${folder}/${name}`);
          // Valores de la columna del kanban o del día del calendario.
          for (const [key, value] of Object.entries(preset)) {
            await setProperty(path, key, value);
          }
          await reloadTree();
          setDbReloadKey((k) => k + 1);
        }),
    });
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
          await afterRelocate(node.path, await renameEntry(node.path, name));
        }),
    });
  }

  /** Tras renombrar o mover: sigue en la nota o tabla abierta y avisa. */
  async function afterRelocate(oldPath: string, result: { path: string; updated_notes: number }) {
    await reloadTree();
    if (database && isInside(database, oldPath)) {
      setDatabase(result.path + database.slice(oldPath.length));
    }
    const current = noteRef.current;
    if (current) {
      // La nota abierta puede haber cambiado de ruta o de enlaces.
      const path = isInside(current.path, oldPath)
        ? result.path + current.path.slice(oldPath.length)
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
  }

  /** Arrastrar en el árbol: mueve una nota o carpeta a otra carpeta. */
  function moveTo(path: string, folder: string) {
    const parent = path.split("/").slice(0, -1).join("/");
    if (parent === folder || folder === path) return;
    run(async () => {
      await autosaver.flush();
      await afterRelocate(path, await moveEntry(path, folder));
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
          if (database && isInside(database, node.path)) setDatabase(null);
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
            { label: "Nueva base de datos", onSelect: () => createDatabaseHere() },
            {
              label: "Nueva nota desde plantilla",
              onSelect: () => chooseTemplate({ mode: "new", folder: "" }),
            },
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
                  {
                    label: "Nueva nota desde plantilla",
                    onSelect: () =>
                      chooseTemplate({ mode: "new", folder: node.path }),
                  },
                  node.database
                    ? {
                        label: "Abrir como tabla",
                        onSelect: () => openDatabase(node.path),
                      }
                    : {
                        label: "Convertir en base de datos",
                        onSelect: () =>
                          run(async () => {
                            await createDatabase(node.path);
                            await reloadTree();
                            await openDatabase(node.path);
                          }),
                      },
                ]
              : []),
            { label: "Renombrar", onSelect: () => rename(node) },
            {
              label: "Mostrar en el explorador",
              onSelect: () => revealInSystem(node.path).catch((err) => showError(String(err))),
            },
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

  /** Acciones de la paleta de comandos (Ctrl+P). */
  const commands: { id: string; name: string; hint?: string; run: () => void; needsNote?: boolean }[] = [
    { id: "new-note", name: "Nueva nota", hint: "Ctrl+N", run: () => newNote() },
    { id: "new-folder", name: "Nueva carpeta", run: () => newFolder() },
    { id: "new-db", name: "Nueva base de datos", run: () => createDatabaseHere() },
    { id: "from-template", name: "Nueva nota desde plantilla", run: () => chooseTemplate({ mode: "new", folder: "" }) },
    { id: "search", name: "Buscar notas", hint: "Ctrl+K", run: () => setSearching(true) },
    { id: "find", name: "Buscar en la nota", hint: "Ctrl+F", run: () => setFindOpen(true), needsNote: true },
    { id: "export-pdf", name: "Exportar a PDF", run: () => exportNote("pdf"), needsNote: true },
    { id: "export-html", name: "Exportar a HTML", run: () => exportNote("html"), needsNote: true },
    { id: "add-property", name: "Añadir propiedad a la nota", run: () => addProperty(), needsNote: true },
    { id: "git-sync", name: "Sincronizar con Git", run: () => window.dispatchEvent(new Event("botion-git-sync")) },
    { id: "theme-light", name: "Tema claro", run: () => applyTheme("light") },
    { id: "theme-dark", name: "Tema oscuro", run: () => applyTheme("dark") },
    { id: "theme-system", name: "Tema del sistema", run: () => applyTheme("system") },
    { id: "open-vault", name: "Abrir otra bóveda", run: () => handleOpenVault() },
  ];
  const availableCommands = commands.filter((c) => !c.needsNote || note);

  // Atajos: Ctrl/Cmd + N nueva nota; K buscar notas; P comandos; F buscar en la nota.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || !vault) return;
      const key = e.key.toLowerCase();
      if (key === "n") {
        e.preventDefault();
        newNote();
      } else if (key === "k") {
        e.preventDefault();
        setSearching(true);
      } else if (key === "p") {
        e.preventDefault();
        setCommandsOpen(true);
      } else if (key === "f" && noteRef.current) {
        e.preventDefault();
        setFindOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const noteIcon = typeof props[ICON_KEY] === "string" ? (props[ICON_KEY] as string) : null;
  const noteCover = typeof props[COVER_KEY] === "string" ? (props[COVER_KEY] as string) : null;
  const visibleProps = Object.fromEntries(
    Object.entries(props).filter(([k]) => k !== ICON_KEY && k !== COVER_KEY),
  );

  return (
    <div className="flex h-full">
      <Sidebar
        vault={vault}
        selected={note?.path ?? database}
        onSelect={(path) => openNote(path)}
        onSelectDatabase={openDatabase}
        onOpenVault={handleOpenVault}
        onNewNote={(folder) => newNote(folder)}
        onNewFolder={() => newFolder()}
        onSearch={() => setSearching(true)}
        onCommands={() => setCommandsOpen(true)}
        onContextMenu={handleContextMenu}
        onMove={moveTo}
        footer={
          vault && (
            <GitPanel
              root={vault.root}
              beforeSync={beforeSync}
              onSynced={handleSynced}
              onError={showError}
            />
          )
        }
      />
      <main className="flex min-w-0 flex-1 flex-col">
        {(error || notice) && (
          <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex max-w-sm flex-col gap-2">
            {error && (
              <div
                role="alert"
                className="pointer-events-auto flex animate-pop items-start gap-2 rounded-lg bg-white px-3 py-2.5 text-sm text-red-700 shadow-pop dark:bg-neutral-800 dark:text-red-300"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                <span className="flex-1">{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-100"
                  aria-label="Cerrar error"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}
            {notice && (
              <div
                role="status"
                className="pointer-events-auto flex animate-pop items-start gap-2 rounded-lg bg-white px-3 py-2.5 text-sm text-neutral-700 shadow-pop dark:bg-neutral-800 dark:text-neutral-200"
              >
                <Info className="mt-0.5 size-4 shrink-0 text-violet-500" />
                <span className="flex-1">{notice}</span>
                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-100"
                  aria-label="Cerrar aviso"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}
          </div>
        )}
        {note ? (
          <div
            className="flex-1 overflow-y-auto"
            onKeyDownCapture={markEdit}
            onBeforeInputCapture={markEdit}
            onPasteCapture={markEdit}
            onDropCapture={markEdit}
          >
            <NoteTopBar
              path={note.path}
              icon={noteIcon}
              status={STATUS_TEXT[status]}
              isDatabase={(folder) => !!findFolder(vault?.tree ?? [], folder)?.database}
              onOpenDatabase={openDatabase}
              onExport={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                showMenu(r.right - 192, r.bottom + 4, [
                  { label: "Exportar a PDF", onSelect: () => exportNote("pdf") },
                  { label: "Exportar a HTML", onSelect: () => exportNote("html") },
                ]);
              }}
            />
            <div className={noteCover ? "" : "pt-10"}>
              <PageHeader
                icon={noteIcon}
                cover={noteCover}
                vaultRoot={vault?.root ?? ""}
                notePath={note.path}
                onIcon={(icon) => changeProperty(ICON_KEY, icon, true)}
                onCover={(cover) => changeProperty(COVER_KEY, cover, true)}
                onUploadCover={async () => {
                  const file = await pickFile("image/*");
                  if (!file) return null;
                  try {
                    return await saveAttachment(note.path, file);
                  } catch (e) {
                    showError(String(e));
                    return null;
                  }
                }}
              />
            </div>
            <div className="mx-auto w-full max-w-3xl pt-4">
              <PropertiesPanel
                path={note.path}
                props={visibleProps}
                kinds={propKinds}
                options={propOptions}
                relations={propRelations}
                onOpenLink={handleOpenLink}
                onChange={changeProperty}
                onRemove={(key) => changeProperty(key, null)}
                onAdd={addProperty}
              />
              <Editor
                key={`${note.path}#${note.version}`}
                initialValue={note.body}
                onChange={handleChange}
                onOpenLink={handleOpenLink}
                onRequestLink={(insert) => setLinkRequest(() => insert)}
                onAddProperty={addProperty}
                onCreateDatabase={() =>
                  createDatabaseHere(note.path.split("/").slice(0, -1).join("/"))
                }
                onRequestTemplate={(insert) =>
                  chooseTemplate({ mode: "insert", insert })
                }
                linkExists={linkExists}
                onRequestPage={requestPage}
                onNotify={setNotice}
                onRequestDatabase={(insert) => setDbPicker(() => insert)}
                embedHost={embedHost}
                vaultRoot={vault?.root ?? ""}
                notePath={note.path}
                onError={showError}
                onExport={exportNote}
                findOpen={findOpen}
                onCloseFind={() => setFindOpen(false)}
                onSetPageIcon={(icon) => changeProperty(ICON_KEY, icon, true)}
                onAddCover={() => {
                  const names = Object.keys(COVERS);
                  if (!noteCover) {
                    changeProperty(COVER_KEY, names[Math.floor(Math.random() * names.length)], true);
                  }
                }}
                onRequestUrl={(title, insert) =>
                  setDialog({
                    kind: "prompt",
                    title,
                    label: "Dirección (https://…)",
                    initial: "",
                    confirm: "Insertar",
                    onConfirm: (url) => insert(url),
                  })
                }
              />
              <Backlinks
                backlinks={backlinks}
                onSelect={(path) => openNote(path)}
              />
            </div>
          </div>
        ) : database ? (
          <DatabaseView
            key={database}
            path={database}
            reloadKey={dbReloadKey}
            onOpenNote={(path) => openNote(path)}
            onOpenLink={(target) =>
              run(async () => {
                // Relaciones: se buscan como los enlaces de una nota de la carpeta.
                const path = await resolveNoteLink(target, `${database}/_.md`);
                if (path) await openNote(path);
                else setError(`No existe la nota «${target}»`);
              })
            }
            onNewRow={newRow}
            onError={showError}
            showDialog={setDialog}
            databases={listDatabases()}
            vaultRoot={vault?.root ?? ""}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div className="max-w-md">
              <img src={logo} alt="" className="mx-auto size-16 rounded-2xl shadow-lg" />
              <h1 className="mt-5 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                Bienvenido a Botion
              </h1>
              <p className="mt-2 text-neutral-500">
                {vault
                  ? "Elige una nota en la barra lateral o crea una nueva."
                  : "Abre una carpeta con notas Markdown para empezar."}
              </p>
              <div className="mt-6 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={vault ? () => newNote() : handleOpenVault}
                  className="flex items-center gap-1.5 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
                >
                  {vault ? <SquarePen className="size-4" /> : <FolderOpen className="size-4" />}
                  {vault ? "Nueva nota" : "Abrir carpeta"}
                </button>
                {vault && (
                  <button
                    type="button"
                    onClick={() => setSearching(true)}
                    className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  >
                    <Search className="size-4" /> Buscar
                  </button>
                )}
              </div>
              {vault && (
                <p className="mt-8 space-x-4 text-xs text-neutral-400">
                  <span><kbd>Ctrl K</kbd> buscar</span>
                  <span><kbd>Ctrl P</kbd> comandos</span>
                  <span><kbd>/</kbd> bloques</span>
                </p>
              )}
            </div>
          </div>
        )}
      </main>
      {menu && <ContextMenu {...menu} onClose={closeMenu} />}
      {dialog && <Dialog request={dialog} onClose={closeDialog} />}
      {commandsOpen && (
        <SearchPalette
          placeholder="Escribe un comando…"
          recentLabel="Comandos"
          icon={Zap}
          allowCreate={false}
          source={async (query) => {
            const fold = (t: string) =>
              t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const q = fold(query.trim());
            return availableCommands
              .filter((c) => fold(c.name).includes(q))
              .map((c) => ({ path: c.id, name: c.name, snippet: c.hint ?? "" }));
          }}
          onOpen={(id) => commands.find((c) => c.id === id)?.run()}
          onCreate={() => {}}
          onClose={() => setCommandsOpen(false)}
        />
      )}
      {dbPicker && (
        <SearchPalette
          placeholder="Elegir base de datos…"
          recentLabel="Bases de datos"
          icon={Table2}
          allowCreate={false}
          source={async (query) =>
            listDatabases()
              .filter((d) => d.path.toLowerCase().includes(query.trim().toLowerCase()))
              .map((d) => ({ ...d, snippet: "" }))
          }
          onOpen={(path) => dbPicker(path)}
          onCreate={() => {}}
          onClose={closeDbPicker}
        />
      )}
      {templateRequest && (
        <SearchPalette
          placeholder="Elegir plantilla…"
          recentLabel="Plantillas"
          icon={LayoutTemplate}
          allowCreate={false}
          source={async (query) =>
            listTemplates(vault?.tree ?? [])
              .filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()))
              .map((t) => ({ ...t, snippet: "" }))
          }
          onOpen={(path) =>
            templateRequest.mode === "insert"
              ? insertTemplate(path, templateRequest.insert)
              : newNoteFromTemplate(path, templateRequest.folder)
          }
          onCreate={() => {}}
          onClose={closeTemplatePicker}
        />
      )}
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
