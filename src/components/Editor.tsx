import { Crepe } from "@milkdown/crepe";
import { remarkStringifyOptionsCtx } from "@milkdown/kit/core";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import "./editor.css";
import { createRoot } from "react-dom/client";
import { callout } from "../lib/callout";
import { embed, embedSchema } from "../lib/embed";
import { Embed, type EmbedHost } from "./Embed";
import { $view } from "@milkdown/kit/utils";
import { highlight, highlightSchema, toggleHighlightCommand } from "../lib/highlight";
import { renderMermaidPreview } from "../lib/mermaid";
import { buildBotionMenu } from "../lib/slashCommands";
import { wikiLink, wikiLinkStatus, wikiLinkStatusKey } from "../lib/wikilink";
import { commandsCtx, editorViewCtx } from "@milkdown/kit/core";
import { useEffect, useRef } from "react";

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
}: Props) {
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

  useEffect(() => {
    const crepe = new Crepe({
      root: rootRef.current,
      defaultValue: initialValue,
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
            image: { label: "Imagen" },
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

    crepe.editor.use(embed).use(embedView).use(callout).use(highlight).use(wikiLink).use(wikiLinkStatus(() => linkExistsRef.current));

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

  return <div ref={rootRef} className="botion-editor" onClick={handleClick} />;
}
