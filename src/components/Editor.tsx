import { Crepe } from "@milkdown/crepe";
import { remarkStringifyOptionsCtx } from "@milkdown/kit/core";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import "./editor.css";
import { buildBotionMenu } from "../lib/slashCommands";
import { wikiLink, wikiLinkStatus, wikiLinkStatusKey } from "../lib/wikilink";
import { editorViewCtx } from "@milkdown/kit/core";
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

  useEffect(() => {
    const crepe = new Crepe({
      root: rootRef.current,
      defaultValue: initialValue,
      featureConfigs: {
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
          }),
        },
      },
    });
    crepe.editor.use(wikiLink).use(wikiLinkStatus(() => linkExistsRef.current));

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
    const link = (e.target as HTMLElement).closest<HTMLElement>("[data-wikilink]");
    if (link?.dataset.wikilink) {
      e.preventDefault();
      onOpenLinkRef.current(link.dataset.wikilink);
    }
  }

  return <div ref={rootRef} className="botion-editor" onClick={handleClick} />;
}
