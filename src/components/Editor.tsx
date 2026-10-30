import { Crepe } from "@milkdown/crepe";
import { openUrl } from "@tauri-apps/plugin-opener";
import { remarkStringifyOptionsCtx } from "@milkdown/kit/core";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import "./editor.css";
import { createRoot } from "react-dom/client";
import { callout } from "../lib/callout";
import { embed, embedSchema } from "../lib/embed";
import { Embed, type EmbedHost } from "./Embed";
import { EmojiPicker } from "./EmojiPicker";
import { Popover, PopoverItem } from "./Popover";
import {
  BLOCK_KINDS,
  blockIdAt,
  convertBlock,
  deleteBlock,
  duplicateBlock,
  mentionPlugin,
  type Mention,
} from "../lib/blocks";
import { $prose, $view } from "@milkdown/kit/utils";
import { Plugin } from "@milkdown/kit/prose/state";
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
import { parseButton, type ButtonSpec } from "../lib/button";
import { buildBotionMenu, type PageAction } from "../lib/slashCommands";
import { docStats, type DocStats } from "../lib/outline";
import { taskDates } from "../lib/taskDates";
import { setTextColor, textColor } from "../lib/textColor";
import { comments } from "../lib/comments";
import { insertComment } from "../lib/slashCommands";
import { newBlockId } from "../lib/blockRefs";
import { ColorMenu } from "./ColorMenu";
import { CommentMargin, type MarginComment } from "./CommentMargin";
import { wikiLink, wikiLinkStatus, wikiLinkStatusKey } from "../lib/wikilink";
import { commandsCtx, editorViewCtx } from "@milkdown/kit/core";
import { useEffect, useRef, useState } from "react";
import { findCounts, findPlugin, moveFind, setFindQuery } from "../lib/find";

export interface EditorProps {
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
  /** Al escribir «@»: pide una nota o fecha para mencionar. */
  onRequestMention: (insert: (mention: Mention) => void) => void;
  /** Aquí se deja una función que avisa ya del texto pendiente. */
  flushRef?: React.MutableRefObject<(() => void) | null>;
  /** Comandos de estilo de página, índice lateral y modo sin distracciones. */
  onPageAction: (action: PageAction) => void;
  /** Comando «/Nota de hoy». */
  onRequestDailyNote: (insert: (target: string) => void) => void;
  /** Comandos «/Fecha de vencimiento» y «/Recordatorio». */
  onRequestDate: (title: string, withTime: boolean, insert: (date: string, time: string | null) => void) => void;
  /** Comando «/Repetir tarea». */
  onRequestRepeat: (insert: (rule: string) => void) => void;
  /** Comando «/Bloque sincronizado»: elegir nota y bloque. */
  onRequestBlockRef: (insert: (target: string) => void) => void;
  /** Al pulsar un botón (bloque ```boton). */
  onButton: (spec: ButtonSpec) => void;
  /** Títulos y palabras de la nota, al abrirla y al cambiarla. */
  onStats?: (stats: DocStats) => void;
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
  onRequestMention,
  flushRef,
  onPageAction,
  onRequestDailyNote,
  onStats,
  onRequestDate,
  onRequestRepeat,
  onButton,
  onRequestBlockRef,
}: EditorProps) {
  const [blockMenu, setBlockMenu] = useState<{ anchor: HTMLElement; pos: number } | null>(null);
  const [colorMenu, setColorMenu] = useState<{ anchor: DOMRect; from: number; to: number } | null>(null);
  /** Comentarios `%%…%%` de la nota y el que se está editando. */
  const [noteComments, setNoteComments] = useState<MarginComment[]>([]);
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [emojiPicker, setEmojiPicker] = useState<{
    x: number;
    y: number;
    pick: (emoji: string) => void;
  } | null>(null);
  const pageRef = useRef({ onSetPageIcon, onAddCover, onRequestUrl, onRequestMention, onPageAction, onRequestDailyNote, onStats, onRequestDate, onRequestRepeat, onButton, onRequestBlockRef });
  pageRef.current = { onSetPageIcon, onAddCover, onRequestUrl, onRequestMention, onPageAction, onRequestDailyNote, onStats, onRequestDate, onRequestRepeat, onButton, onRequestBlockRef };
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
          // Diagramas y botones se ven ya dibujados; «Editar» enseña el texto.
          previewOnlyByDefault: true,
          renderPreview: (language, content, apply) => {
            if (language.toLowerCase() !== "boton") return renderMermaidPreview(language, content, apply);
            // Milkdown copia la vista previa como HTML: el clic se atiende en
            // handleClick con el texto del bloque guardado en data-boton.
            const button = document.createElement("button");
            button.type = "button";
            button.className = "note-button";
            button.dataset.boton = content;
            button.textContent = parseButton(content).label;
            return button;
          },
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
            builder.getGroup("formatting").addItem("color", {
              label: "Color",
              icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="botion-icon"><path d="M4 20h16"/><path d="M7 16l5-12 5 12M8.7 12h6.6"/></svg>',
              active: () => false,
              onRun: (ctx) => {
                const view = ctx.get(editorViewCtx);
                const { from, to } = view.state.selection;
                const a = view.coordsAtPos(from);
                setColorMenu({ anchor: new DOMRect(a.left, a.top, 0, a.bottom - a.top), from, to });
              },
            });
            builder.getGroup("formatting").addItem("comment", {
              label: "Comentar",
              icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="botion-icon"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
              active: () => false,
              onRun: (ctx) => setEditingComment(insertComment(ctx.get(editorViewCtx))),
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
            requestMention: (insert) => pageRef.current.onRequestMention(insert),
            pageAction: (action) => pageRef.current.onPageAction(action),
            requestDailyNote: (insert) => pageRef.current.onRequestDailyNote(insert),
            requestDate: (title, withTime, insert) => pageRef.current.onRequestDate(title, withTime, insert),
            requestRepeat: (insert) => pageRef.current.onRequestRepeat(insert),
            requestColor: (at, from, to) => setColorMenu({ anchor: new DOMRect(at.x, at.y - 6, 0, 0), from, to }),
            editComment: (pos) => setEditingComment(pos),
            requestBlockRef: (insert) => pageRef.current.onRequestBlockRef(insert),
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
      writeNote: (p, c) => embedHostRef.current.writeNote(p, c),
      readFile: (p) => embedHostRef.current.readFile(p),
      createNote: (t) => embedHostRef.current.createNote(t),
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
        // Botones, el texto de un bloque sincronizado y el visor de PDF son de
        // la incrustación, no del editor.
        stopEvent: (e) =>
          e.type !== "dragstart" && (e.target as HTMLElement).closest("button, textarea, input, .pdf-pages") !== null,
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
      // ![](https://youtube.com/…): miniatura del vídeo; al pulsarla se abre en
      // el navegador. YouTube no deja reproducir dentro de una app de
      // escritorio (error 153: la página no viene de una web).
      const video = youtubeId(initial.attrs.src);
      if (video) {
        const card = document.createElement("span");
        card.className = "youtube-card";
        card.contentEditable = "false";
        card.title = "Ver en YouTube";
        card.setAttribute("role", "link");
        const thumb = document.createElement("img");
        thumb.src = `https://i.ytimg.com/vi/${video}/hqdefault.jpg`;
        thumb.alt = initial.attrs.alt || "Vídeo de YouTube";
        const play = document.createElement("span");
        play.className = "youtube-play";
        play.textContent = "▶";
        const label = document.createElement("span");
        label.className = "youtube-label";
        label.textContent = "Ver en YouTube ↗";
        card.append(thumb, play, label);
        card.addEventListener("click", (e) => {
          e.preventDefault();
          openUrl(`https://www.youtube.com/watch?v=${video}`).catch(() => window.open(initial.attrs.src, "_blank"));
        });
        return {
          dom: card,
          update: (node) => node.type.name === "image" && youtubeId(node.attrs.src) === video,
          stopEvent: (e) => e.type === "click",
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

    // «@nota» o «@fecha»: sustituye la arroba por el enlace o la fecha.
    const mentions = mentionPlugin((pos, view) =>
      pageRef.current.onRequestMention((m) => {
        if (view.state.doc.textBetween(pos, pos + 1) !== "@") return;
        const { schema } = view.state;
        const node =
          m.kind === "note"
            ? schema.nodes.wikilink.create({ target: m.target, alias: null })
            : schema.text(m.text);
        const tr = view.state.tr.replaceWith(pos, pos + 1, node);
        view.dispatch(tr.insertText(" ", pos + node.nodeSize));
        view.focus();
      }),
    );

    // Títulos y palabras para el índice lateral (con un poco de retraso).
    const stats = $prose(
      () =>
        new Plugin({
          view: (view) => {
            let timer: ReturnType<typeof setTimeout> | undefined;
            const report = () => {
              clearTimeout(timer);
              timer = setTimeout(() => pageRef.current.onStats?.(docStats(view.state.doc)), 150);
            };
            report();
            // Comentarios de la nota, para dibujarlos al margen.
            const listComments = (doc: typeof view.state.doc) => {
              const found: MarginComment[] = [];
              doc.descendants((node, pos) => {
                if (node.type.name === "comment") found.push({ pos, text: node.attrs.text });
              });
              setNoteComments(found);
            };
            listComments(view.state.doc);
            return {
              update: (v, prev) => {
                if (!v.state.doc.eq(prev.doc)) {
                  report();
                  listComments(v.state.doc);
                }
              },
              destroy: () => clearTimeout(timer),
            };
          },
        }),
    );

    crepe.editor.use(stats).use(taskDates).use(textColor).use(comments).use(mentions).use(findPlugin).use(imageView).use(embed).use(embedView).use(callout).use(highlight).use(wikiLink).use(wikiLinkStatus(() => linkExistsRef.current));

    // Mismo estilo que la mayoría de editores: "- lista" y "---".
    crepe.editor.config((ctx) => {
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        bullet: "-" as const,
        rule: "-" as const,
      }));
    });

    // Milkdown normaliza la nota al cargarla; solo se avisa de cambios
    // reales respecto a lo último avisado (también si se vuelve al texto
    // del principio), para no reescribir notas sin tocarlas.
    let last: string | null = null;
    const emit = (markdown: string) => {
      if (last === null || markdown === last) return;
      last = markdown;
      onChangeRef.current(markdown);
    };
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => emit(markdown));
    });
    const ready = crepe.create().then(() => {
      last = crepe.getMarkdown();
      crepeRef.current = crepe;
      // Milkdown avisa de los cambios con retraso: así se puede pedir el
      // texto actual antes de cambiar de nota o cerrar.
      if (flushRef) flushRef.current = () => emit(crepe.getMarkdown());
    });

    return () => {
      crepeRef.current = null;
      if (flushRef) flushRef.current = null;
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

    // Clic en el asa ⋮⋮ de un bloque: menú «Convertir en…».
    const handle = target.closest<HTMLElement>(".milkdown-block-handle .operation-item:last-child");
    if (handle) {
      withView((view) => {
        const r = handle.getBoundingClientRect();
        const left = view.dom.getBoundingClientRect().left + 64;
        const hit = view.posAtCoords({ left, top: r.top + r.height / 2 });
        if (hit) setBlockMenu({ anchor: handle, pos: hit.pos });
      });
      return;
    }

    // Botón de la nota (bloque ```boton).
    const noteButton = target.closest<HTMLElement>(".note-button");
    if (noteButton?.dataset.boton !== undefined) {
      e.preventDefault();
      pageRef.current.onButton(parseButton(noteButton.dataset.boton));
      return;
    }

    // Clic en un 💬: se abre el comentario.
    const comment = target.closest<HTMLElement>(".note-comment");
    if (comment) {
      withView((view) => setEditingComment(view.posAtDOM(comment, 0)));
      return;
    }

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
      <div className="relative">
      <div ref={rootRef} className="botion-editor" onClick={handleClick} />
      <CommentMargin
        root={rootRef.current}
        comments={noteComments}
        editing={editingComment}
        coordsOf={(pos) => withView((view) => view.coordsAtPos(pos)) ?? null}
        onEdit={setEditingComment}
        onSave={(pos, text) =>
          withView((view) => {
            const node = view.state.doc.nodeAt(pos);
            if (node?.type.name !== "comment") return;
            view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { text }));
            view.focus();
          })
        }
        onDelete={(pos) =>
          withView((view) => {
            const node = view.state.doc.nodeAt(pos);
            if (node?.type.name === "comment") view.dispatch(view.state.tr.delete(pos, pos + node.nodeSize));
            view.focus();
          })
        }
      />
      </div>
      {colorMenu && (
        <ColorMenu
          anchor={colorMenu.anchor}
          onClose={() => setColorMenu(null)}
          onPick={(patch) => withView((view) => setTextColor(view, colorMenu.from, colorMenu.to, patch))}
        />
      )}
      {blockMenu && (
        <Popover anchor={blockMenu.anchor} onClose={() => setBlockMenu(null)} className="w-52 p-1">
          <p className="px-2 pt-1 pb-1 text-xs text-neutral-400">Convertir en</p>
          {BLOCK_KINDS.map((b) => (
            <PopoverItem
              key={b.kind}
              onClick={() => {
                setBlockMenu(null);
                withView((view) => convertBlock(view, blockMenu.pos, b.kind));
              }}
            >
              {b.label}
            </PopoverItem>
          ))}
          <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />
          <PopoverItem onClick={() => (setBlockMenu(null), withView((view) => duplicateBlock(view, blockMenu.pos)))}>
            Duplicar
          </PopoverItem>
          <PopoverItem
            onClick={() => {
              setBlockMenu(null);
              const id = withView((view) => blockIdAt(view, blockMenu.pos, newBlockId));
              if (!id) return;
              const name = notePath.split("/").pop()!.replace(/\.md$/i, "");
              navigator.clipboard?.writeText(`![[${name}#^${id}]]`).catch(() => {});
              onNotifyRef.current("Copiado. Pégalo en otra nota: el bloque se verá y editará en las dos.");
            }}
          >
            Copiar como bloque sincronizado
          </PopoverItem>
          <PopoverItem danger onClick={() => (setBlockMenu(null), withView((view) => deleteBlock(view, blockMenu.pos)))}>
            Eliminar
          </PopoverItem>
        </Popover>
      )}
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
