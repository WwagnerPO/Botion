import { Crepe } from "@milkdown/crepe";
import { remarkStringifyOptionsCtx } from "@milkdown/kit/core";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import "./editor.css";
import { createRoot } from "react-dom/client";
import { callout } from "../lib/callout";
import { embed, embedSchema } from "../lib/embed";
import { Embed, type EmbedHost } from "./Embed";
import { EmojiPicker } from "./EmojiPicker";
import { $view } from "@milkdown/kit/utils";
import { upload, uploadConfig } from "@milkdown/kit/plugin/upload";
import { imageSchema } from "@milkdown/kit/preset/commonmark";
import {
  displayUrl,
  linkToVaultPath,
  pickFile,
  saveAttachment,
  youtubeId,
} from "../lib/attachments";
import { highlight, highlightSchema, toggleHighlightCommand } from "../lib/highlight";
import { renderMermaidPreview } from "../lib/mermaid";
import { buildBotionMenu } from "../lib/slashCommands";
import { wikiLink, wikiLinkStatus, wikiLinkStatusKey } from "../lib/wikilink";
import { commandsCtx, editorViewCtx } from "@milkdown/kit/core";
import { useEffect, useRef, useState } from "react";
import { findCounts, findPlugin, moveFind, setFindQuery } from "../lib/find";

interface Props {
  initialValue: string;
  onChange: (markdown: string) => void;
  /** Se llama al hacer clic en un enlace `[[nota]]`. */
  onOpenLink: (target: string) => void;
  /** Comando «/Enlace a nota»: pide elegir una nota e inserta el enlace. */
  onRequestLink: (insert: (target: string) => void) => void;
  /** Comando «/Propiedad». */
  onAddProperty: () => void;
  /** Comando «/Base de datos». */
  onCreateDatabase: () => void;
  /** Comando «/Plantilla»: pide elegir una e inserta su Markdown. */
  onRequestTemplate: (insert: (markdown: string) => void) => void;
  /** Dice si un enlace `[[...]]` apunta a una nota que existe. */
  linkExists: (target: string) => boolean;
  /** Comando «/Página». */
  onRequestPage: (insert: (target: string) => void) => void;
  onNotify: (message: string) => void;
  /** Comando «/Vista de base de datos». */
  onRequestDatabase: (insert: (folder: string) => void) => void;
  /** Lo que necesitan las incrustaciones `![[...]]`. */
  embedHost: EmbedHost;
  /** Barra de «Buscar en la nota» (Ctrl+F) abierta. */
  findOpen: boolean;
  onCloseFind: () => void;
  /** Comandos «/Exportar a PDF» y «/Exportar a HTML». */
  onExport: (format: "html" | "pdf") => void;
  /** Para guardar y mostrar imágenes adjuntas. */
  vaultRoot: string;
  notePath: string;
  onError: (message: string) => void;
  /** Comandos «/Icono de la página» y «/Portada». */
  onSetPageIcon: (emoji: string) => void;
  onAddCover: () => void;
  /** Pide una dirección web (comando «/YouTube»). */
  onRequestUrl: (title: string, insert: (url: string) => void) => void;
}

/**
 * Editor visual de Markdown. Se monta una vez por nota: para cambiar de
 * nota, el padre cambia la `key` del componente.
 */
export function Editor({
  initialValue,
  onChange,
  onOpenLink,
  onRequestLink,
  onAddProperty,
  onCreateDatabase,
  onRequestTemplate,
  linkExists,
  onRequestPage,
  onNotify,
  onRequestDatabase,
  embedHost,
  vaultRoot,
  notePath,
  onError,
  onExport,
  findOpen,
  onCloseFind,
  onSetPageIcon,
  onAddCover,
  onRequestUrl,
}: Props) {
  const [emojiPicker, setEmojiPicker] = useState<{
    x: number;
    y: number;
    pick: (emoji: string) => void;
  } | null>(null);
  const pageRef = useRef({ onSetPageIcon, onAddCover, onRequestUrl });
  pageRef.current = { onSetPageIcon, onAddCover, onRequestUrl };
  const rootRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onOpenLinkRef = useRef(onOpenLink);
  onOpenLinkRef.current = onOpenLink;
  const onRequestLinkRef = useRef(onRequestLink);
  onRequestLinkRef.current = onRequestLink;
  const onAddPropertyRef = useRef(onAddProperty);
  onAddPropertyRef.current = onAddProperty;
  const onCreateDatabaseRef = useRef(onCreateDatabase);
  onCreateDatabaseRef.current = onCreateDatabase;
  const onRequestTemplateRef = useRef(onRequestTemplate);
  onRequestTemplateRef.current = onRequestTemplate;
  const linkExistsRef = useRef(linkExists);
  linkExistsRef.current = linkExists;
  const crepeRef = useRef<Crepe | null>(null);
  const onRequestPageRef = useRef(onRequestPage);
  onRequestPageRef.current = onRequestPage;
  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;
  const onRequestDatabaseRef = useRef(onRequestDatabase);
  onRequestDatabaseRef.current = onRequestDatabase;
  const embedHostRef = useRef(embedHost);
  embedHostRef.current = embedHost;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onExportRef = useRef(onExport);
  onExportRef.current = onExport;

  useEffect(() => {
    const crepe = new Crepe({
      root: rootRef.current,
      defaultValue: initialValue,
      // El bloque de imagen de Milkdown guarda el tamaño en el texto
      // alternativo (![1.00](...)) y estropea las notas; se usa una vista
      // de imagen propia que respeta el Markdown.
      features: { [Crepe.Feature.ImageBlock]: false },
      featureConfigs: {
        [Crepe.Feature.CodeMirror]: {
          renderPreview: renderMermaidPreview,
          previewLabel: "Vista previa",
          previewLoading: "Cargando…",
          previewToggleText: (previewOnly) => (previewOnly ? "Editar" : "Ocultar"),
        },
        [Crepe.Feature.Toolbar]: {
          // Botón de resaltar en la barra que aparece al seleccionar texto.
          buildToolbar: (builder) => {
            builder.getGroup("formatting").addItem("highlight", {
              label: "Resaltar",
              shortcut: "Ctrl+Mayús+H",
              icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="botion-icon"><path d="M4 20h16"/><path d="M14.5 4.5l5 5L10 19H5v-5z"/></svg>',
              active: (ctx) => {
                const { state } = ctx.get(editorViewCtx);
                const type = highlightSchema.type(ctx);
                const { from, to } = state.selection;
                return state.doc.rangeHasMark(from, to, type);
              },
              onRun: (ctx) => ctx.get(commandsCtx).call(toggleHighlightCommand.key),
            });
          },
        },
        [Crepe.Feature.Placeholder]: {
          text: "Escribe algo o pulsa «/» para insertar un bloque…",
        },
        [Crepe.Feature.BlockEdit]: {
          textGroup: {
            label: "Texto",
            text: { label: "Texto" },
            h1: { label: "Título 1" },
            h2: { label: "Título 2" },
            h3: { label: "Título 3" },
            h4: { label: "Título 4" },
            h5: { label: "Título 5" },
            h6: { label: "Título 6" },
            quote: { label: "Cita" },
            divider: { label: "Separador" },
          },
          listGroup: {
            label: "Listas",
            bulletList: { label: "Lista con viñetas" },
            orderedList: { label: "Lista numerada" },
            taskList: { label: "Lista de tareas" },
          },
          advancedGroup: {
            label: "Avanzado",
            image: null,
            codeBlock: { label: "Código" },
            table: { label: "Tabla" },
            math: { label: "Fórmula" },
          },
          buildMenu: buildBotionMenu({
            requestLink: (insert) => onRequestLinkRef.current(insert),
            addProperty: () => onAddPropertyRef.current(),
            createDatabase: () => onCreateDatabaseRef.current(),
            requestTemplate: (insert) => onRequestTemplateRef.current(insert),
            requestPage: (insert) => onRequestPageRef.current(insert),
            notify: (message) => onNotifyRef.current(message),
            requestDatabase: (insert) => onRequestDatabaseRef.current(insert),
            exportNote: (format) => onExportRef.current(format),
            requestEmoji: (at, pick) => setEmojiPicker({ ...at, pick }),
            setPageIcon: (emoji) => pageRef.current.onSetPageIcon(emoji),
            addCover: () => pageRef.current.onAddCover(),
            requestUrl: (title, insert) => pageRef.current.onRequestUrl(title, insert),
            pickAttachment: async (accept) => {
              const file = await pickFile(accept);
              if (!file) return null;
              try {
                return await saveAttachment(notePath, file);
              } catch (e) {
                onErrorRef.current(String(e));
                return null;
              }
            },
          }),
        },
      },
    });
    // Las incrustaciones se dibujan con React dentro de ProseMirror.
    const host: EmbedHost = {
      resolve: (t) => embedHostRef.current.resolve(t),
      readNote: (p) => embedHostRef.current.readNote(p),
      getDatabase: (p) => embedHostRef.current.getDatabase(p),
      open: (p, kind) => embedHostRef.current.open(p, kind),
      fileUrl: (p) => embedHostRef.current.fileUrl(p),
      openFile: (p) => embedHostRef.current.openFile(p),
    };
    const embedView = $view(embedSchema.node, () => (initial) => {
      const dom = document.createElement("div");
      dom.className = "embed";
      dom.dataset.embed = initial.attrs.target;
      const root = createRoot(dom);
      let target = initial.attrs.target as string;
      root.render(<Embed target={target} host={host} />);
      return {
        dom,
        update: (node) => {
          if (node.type.name !== "embed") return false;
          if (node.attrs.target !== target) {
            target = node.attrs.target;
            dom.dataset.embed = target;
            root.render(<Embed target={target} host={host} />);
          }
          return true;
        },
        // Los clics de dentro (abrir, filas) son de la incrustación.
        stopEvent: (e) => e.type !== "dragstart" && (e.target as HTMLElement).closest("button") !== null,
        ignoreMutation: () => true,
        destroy: () => setTimeout(() => root.unmount()),
      };
    });

    // Pegar o arrastrar imágenes al editor: se guardan como adjuntos.
    crepe.editor
      .config((ctx) => {
        ctx.update(uploadConfig.key, (prev) => ({
          ...prev,
          uploader: async (files, schema) => {
            const nodes = [];
            for (const file of Array.from(files)) {
              try {
                const src = await saveAttachment(notePath, file);
                const alt = file.name.replace(/\.[^.]+$/, "");
                // Las imágenes se ven en línea; el resto se incrusta como bloque.
                nodes.push(
                  file.type.startsWith("image/")
                    ? schema.nodes.image.create({ src, alt })
                    : schema.nodes.embed.create({ target: linkToVaultPath(src) }),
                );
              } catch (e) {
                onErrorRef.current(String(e));
              }
            }
            return nodes;
          },
        }));
      })
      .use(upload);

    // Imágenes: la ruta relativa de la nota se convierte en una que la app
    // puede mostrar, sin tocar lo que se guarda.
    const imageView = $view(imageSchema.node, () => (initial) => {
      // ![](https://youtube.com/…): el vídeo se reproduce en la nota, como en Obsidian.
      const video = youtubeId(initial.attrs.src);
      if (video) {
        const frame = document.createElement("iframe");
        frame.className = "youtube-embed";
        frame.src = `https://www.youtube-nocookie.com/embed/${video}`;
        frame.title = initial.attrs.alt || "YouTube";
        frame.allow = "encrypted-media; picture-in-picture; fullscreen";
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        return {
          dom: frame,
          update: (node) => node.type.name === "image" && youtubeId(node.attrs.src) === video,
        };
      }
      const img = document.createElement("img");
      img.className = "note-image";
      const apply = (node: typeof initial) => {
        img.src = displayUrl(node.attrs.src, vaultRoot, notePath);
        img.alt = node.attrs.alt ?? "";
        img.title = node.attrs.title ?? "";
      };
      apply(initial);
      return {
        dom: img,
        update: (node) => {
          if (node.type.name !== "image") return false;
          apply(node);
          return true;
        },
      };
    });

    crepe.editor.use(findPlugin).use(imageView).use(embed).use(embedView).use(callout).use(highlight).use(wikiLink).use(wikiLinkStatus(() => linkExistsRef.current));

    // Mismo estilo que la mayoría de editores: "- lista" y "---".
    crepe.editor.config((ctx) => {
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        bullet: "-" as const,
        rule: "-" as const,
      }));
    });

    // Milkdown normaliza la nota al cargarla; solo se avisa de cambios
    // reales respecto a esa versión, para no reescribir notas sin tocarlas.
    let baseline: string | null = null;
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        if (baseline !== null && markdown !== baseline) {
          onChangeRef.current(markdown);
        }
      });
    });
    const ready = crepe.create().then(() => {
      baseline = crepe.getMarkdown();
      crepeRef.current = crepe;
    });

    return () => {
      crepeRef.current = null;
      ready.then(() => crepe.destroy());
    };
    // Solo al montar: el contenido inicial no debe recrear el editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al cambiar las notas de la bóveda, vuelve a marcar los enlaces rotos.
  useEffect(() => {
    crepeRef.current?.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.dispatch(view.state.tr.setMeta(wikiLinkStatusKey, true));
    });
  }, [linkExists]);

  function handleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;

    const link = target.closest<HTMLElement>("[data-wikilink]");
    const dest = link?.dataset.wikilink;
    if (!dest) return;
    e.preventDefault();
    // [[#Sección]]: salta al título de esta misma nota.
    if (dest.startsWith("#")) {
      const name = dest.slice(1).trim().toLowerCase();
      const heading = [...(rootRef.current?.querySelectorAll("h1, h2, h3, h4, h5, h6") ?? [])].find(
        (h) => h.textContent?.trim().toLowerCase() === name,
      );
      heading?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    onOpenLinkRef.current(dest);
  }

  return (
    <>
      {findOpen && (
        <FindBar
          onQuery={(q) => withView((view) => setFindQuery(view, q))}
          onMove={(step) => withView((view) => moveFind(view, step))}
          counts={() => withView((view) => findCounts(view.state)) ?? { total: 0, current: 0 }}
          onClose={() => {
            withView((view) => {
              setFindQuery(view, "");
              view.focus();
            });
            onCloseFind();
          }}
        />
      )}
      <div ref={rootRef} className="botion-editor" onClick={handleClick} />
      {emojiPicker && (
        <EmojiPicker
          x={emojiPicker.x}
          y={emojiPicker.y}
          onPick={emojiPicker.pick}
          onClose={() => {
            setEmojiPicker(null);
            withView((view) => view.focus());
          }}
        />
      )}
    </>
  );

  function withView<T>(f: (view: import("@milkdown/kit/prose/view").EditorView) => T): T | undefined {
    let out: T | undefined;
    crepeRef.current?.editor.action((ctx) => {
      out = f(ctx.get(editorViewCtx));
    });
    return out;
  }
}

/** Barra de buscar en la nota: Enter siguiente, Mayús+Enter anterior, Esc cierra. */
function FindBar({
  onQuery,
  onMove,
  counts,
  onClose,
}: {
  onQuery: (q: string) => void;
  onMove: (step: number) => void;
  counts: () => { total: number; current: number };
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [, refresh] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  const { total, current } = counts();
  const step = (n: number) => {
    onMove(n);
    refresh((x) => x + 1);
    inputRef.current?.focus();
  };

  return (
    <div className="no-print sticky top-12 z-20 mx-14 mb-2 flex animate-pop items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-sm shadow-pop dark:bg-neutral-800">
      <input
        ref={inputRef}
        value={query}
        placeholder="Buscar en la nota…"
        aria-label="Buscar en la nota"
        onChange={(e) => {
          setQuery(e.target.value);
          onQuery(e.target.value);
          inputRef.current?.focus();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            step(e.shiftKey ? -1 : 1);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        className="min-w-0 flex-1 bg-transparent outline-none"
      />
      <span className="shrink-0 text-xs text-neutral-400" aria-live="polite">
        {query ? (total ? `${current + 1} de ${total}` : "Sin resultados") : ""}
      </span>
      <button type="button" onClick={() => step(-1)} aria-label="Anterior" className="px-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">↑</button>
      <button type="button" onClick={() => step(1)} aria-label="Siguiente" className="px-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">↓</button>
      <button type="button" onClick={onClose} aria-label="Cerrar búsqueda" className="px-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100">✕</button>
    </div>
  );
}
