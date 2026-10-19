import { commandsCtx, editorViewCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import { clearTextInCurrentBlockCommand } from "@milkdown/kit/preset/commonmark";
import { TextSelection } from "@milkdown/kit/prose/state";
import { insert } from "@milkdown/kit/utils";
import {
  CALLOUT_TYPES,
  calloutSchema,
  calloutTitleSchema,
  type CalloutType,
} from "./callout";
import { youtubeId } from "./attachments";
import { embedSchema } from "./embed";
import { highlightSchema } from "./highlight";
import { wikiLinkSchema } from "./wikilink";

/**
 * Comandos propios de Botion en el menú «/» del editor, en un grupo
 * aparte de los bloques básicos de Milkdown.
 */

const icon = (path: string) =>
  `<svg class="botion-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

const linkIcon = icon(
  '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
);
const dateIcon = icon(
  '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
);
const timeIcon = icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');
const propertyIcon = icon(
  '<path d="M4 6h6M4 12h6M4 18h6"/><path d="M14 6h6M14 12h6M14 18h6" stroke-dasharray="2 2"/>',
);
const templateIcon = icon(
  '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 12h6M9 16h4"/>',
);
const pageIcon = icon(
  '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M12 11v6M9 14h6"/>',
);
const calloutIcon = icon(
  '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 10h.01M11 10h6M8 14h8"/>',
);
const toggleIcon = icon('<path d="M8 6l6 6-6 6"/><path d="M15 18h5"/>');
const tocIcon = icon('<path d="M4 6h16M7 12h13M10 18h10"/>');
const highlightIcon = icon('<path d="M4 20h16"/><path d="M14.5 4.5l5 5L10 19H5v-5z"/>');
const diagramIcon = icon(
  '<rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="16" width="7" height="5" rx="1"/><path d="M6.5 8v5h11v3"/>',
);
const imageIcon = icon('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>');
const embedIcon = icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h6"/><path d="M15 15l2 2 3-3"/>');
const dbViewIcon = icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10M15 10v10"/>');
const emojiIcon = icon('<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>');
const pageEmojiIcon = icon('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M10 15a3 3 0 0 0 4 0M10.5 11.5h.01M13.5 11.5h.01"/>');
const coverIcon = icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M3 4h18v6H3z" fill="currentColor" stroke="none" opacity=".25"/>');
const videoIcon = icon('<rect x="3" y="5" width="13" height="14" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>');
const audioIcon = icon('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>');
const fileIcon = icon('<path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7-7l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/>');
const youtubeIcon = icon('<rect x="2.5" y="5" width="19" height="14" rx="4"/><path d="M10 9.5v5l4.5-2.5z"/>');
const databaseIcon = icon(
  '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
);

/**
 * Quita solo el «/texto» que se ha escrito para abrir el menú. Si el menú
 * se abrió en mitad de una línea, el resto de la línea se conserva.
 */
function clearSlash(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  const { $from } = view.state.selection;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
  const slash = before.lastIndexOf("/");
  if (slash === -1) {
    ctx.get(commandsCtx).call(clearTextInCurrentBlockCommand.key);
    return;
  }
  view.dispatch(view.state.tr.delete($from.start() + slash, $from.pos));
}

function insertText(ctx: Ctx, text: string) {
  const view = ctx.get(editorViewCtx);
  view.dispatch(view.state.tr.insertText(text));
  view.focus();
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Fecha en formato ISO (2026-10-17): ordenable y útil en propiedades. */
export function today(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function nowTime(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Inserta un enlace `[[target]]` donde está el cursor. */
export function insertWikiLink(ctx: Ctx, target: string) {
  const view = ctx.get(editorViewCtx);
  const node = wikiLinkSchema.type(ctx).create({ target, alias: null });
  view.dispatch(view.state.tr.replaceSelectionWith(node).insertText(" "));
  view.focus();
}

/**
 * Sustituye el párrafo vacío del cursor por un aviso y deja el cursor en
 * el título (desplegables) o en el contenido (avisos).
 */
function insertCallout(ctx: Ctx, type: CalloutType, fold: string) {
  const view = ctx.get(editorViewCtx);
  const { state } = view;
  const title = calloutTitleSchema.type(ctx).create();
  const body = state.schema.nodes.paragraph.create();
  const node = calloutSchema.type(ctx).create({ calloutType: type, fold }, [title, body]);
  const $from = state.selection.$from;
  // En una línea vacía se sustituye; si tiene texto, el aviso va debajo.
  const empty = $from.parent.content.size === 0;
  const start = empty ? $from.before() : $from.after();
  const tr = empty
    ? state.tr.replaceRangeWith(start, $from.after(), node)
    : state.tr.insert(start, node);
  const cursor = fold ? start + 2 : start + 1 + title.nodeSize + 1;
  view.dispatch(tr.setSelection(TextSelection.create(tr.doc, cursor)).scrollIntoView());
  view.focus();
}

/** Inserta un bloque `![[destino]]` en la línea vacía del cursor o debajo. */
function insertEmbed(ctx: Ctx, target: string) {
  const view = ctx.get(editorViewCtx);
  const { state } = view;
  const node = embedSchema.type(ctx).create({ target });
  const $from = state.selection.$from;
  const empty = $from.parent.content.size === 0;
  const tr = empty
    ? state.tr.replaceRangeWith($from.before(), $from.after(), node)
    : state.tr.insert($from.after(), node);
  view.dispatch(tr.scrollIntoView());
  view.focus();
}

/** Índice: lista de los títulos (nivel 2 o más) con enlaces `[[#título]]`. */
function tocMarkdown(ctx: Ctx) {
  const headings: { level: number; text: string }[] = [];
  ctx.get(editorViewCtx).state.doc.descendants((node) => {
    if (node.type.name === "heading" && node.attrs.level > 1) {
      const text = node.textContent.replace(/[[\]|#]/g, "").trim();
      if (text) headings.push({ level: node.attrs.level, text });
    }
    return node.type.name !== "heading";
  });
  if (headings.length === 0) return null;
  const min = Math.min(...headings.map((h) => h.level));
  return headings
    .map((h) => `${"  ".repeat(h.level - min)}- [[#${h.text}]]`)
    .join("\n");
}

/** Posición en pantalla del cursor, para abrir selectores junto a él. */
function caret(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  const { left, bottom } = view.coordsAtPos(view.state.selection.from);
  return { x: left, y: bottom + 6 };
}

/** Inserta un nodo de imagen (también vídeos de YouTube) en el cursor. */
function insertImage(ctx: Ctx, src: string, alt: string) {
  const view = ctx.get(editorViewCtx);
  const node = view.state.schema.nodes.image.create({ src, alt });
  view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView());
  view.focus();
}

export interface SlashHandlers {
  /** Pide elegir una nota; al elegirla se llama a `insert` con su destino. */
  requestLink: (insert: (target: string) => void) => void;
  /** Añade una propiedad (frontmatter) a la nota. */
  addProperty: () => void;
  /** Crea una base de datos junto a la nota. */
  createDatabase: () => void;
  /** Pide elegir una plantilla; al elegirla se inserta su Markdown. */
  requestTemplate: (insert: (markdown: string) => void) => void;
  /** Pide el nombre de una página nueva; al crearla se inserta el enlace. */
  requestPage: (insert: (target: string) => void) => void;
  /** Pide elegir una base de datos; al elegirla se llama con su carpeta. */
  requestDatabase: (insert: (folder: string) => void) => void;
  /** Exportar la nota abierta. */
  exportNote: (format: "html" | "pdf") => void;
  /** Elige un fichero, lo guarda como adjunto y devuelve su enlace. */
  pickAttachment: (accept: string) => Promise<string | null>;
  /** Abre el selector de emojis junto al cursor. */
  requestEmoji: (at: { x: number; y: number }, pick: (emoji: string) => void) => void;
  /** Pone el icono de la nota (propiedad `icono`). */
  setPageIcon: (emoji: string) => void;
  /** Añade una portada a la nota (propiedad `portada`). */
  addCover: () => void;
  /** Pide una dirección web; al darla se llama a `insert`. */
  requestUrl: (title: string, insert: (url: string) => void) => void;
  /** Mensaje breve para la persona (p. ej. si el índice está vacío). */
  notify: (message: string) => void;
}

type MenuBuilder = {
  addGroup: (
    key: string,
    label: string,
  ) => {
    addItem: (
      key: string,
      item: { label: string; icon: string; onRun: (ctx: Ctx) => void },
    ) => unknown;
  };
};

export function buildBotionMenu(handlers: SlashHandlers) {
  return (builder: MenuBuilder) => {
    const group = builder.addGroup("botion", "Botion");
    group.addItem("note-link", {
      label: "Enlace a nota",
      icon: linkIcon,
      onRun: (ctx) => {
        clearSlash(ctx);
        handlers.requestLink((target) => insertWikiLink(ctx, target));
      },
    });
    group.addItem("page", {
      label: "Página",
      icon: pageIcon,
      onRun: (ctx) => {
        clearSlash(ctx);
        handlers.requestPage((target) => insertWikiLink(ctx, target));
      },
    });
    group.addItem("image", {
      label: "Imagen",
      icon: imageIcon,
      onRun: (ctx) => {
        clearSlash(ctx);
        handlers.pickAttachment("image/*").then((src) => {
          if (!src) return;
          insertImage(ctx, src, decodeURI(src).split("/").pop()!.replace(/\.[^.]+$/, ""));
        });
      },
    });
    // Vídeo, audio y otros ficheros: se guardan en adjuntos/ y se incrustan
    // con ![[adjuntos/fichero]], igual que en Obsidian.
    const attachments = [
      { key: "video", label: "Vídeo", icon: videoIcon, accept: "video/*" },
      { key: "audio", label: "Audio", icon: audioIcon, accept: "audio/*" },
      { key: "file", label: "Archivo", icon: fileIcon, accept: "" },
    ];
    for (const a of attachments) {
      group.addItem(a.key, {
        label: a.label,
        icon: a.icon,
        onRun: (ctx) => {
          clearSlash(ctx);
          handlers.pickAttachment(a.accept).then((link) => {
            if (link) insertEmbed(ctx, `adjuntos/${decodeURI(link).split("/").pop()}`);
          });
        },
      });
    }
    group.addItem("youtube", {
      label: "YouTube",
      icon: youtubeIcon,
      onRun: (ctx) => {
        clearSlash(ctx);
        handlers.requestUrl("Vídeo de YouTube", (url) =>
          youtubeId(url)
            ? insertImage(ctx, url, "YouTube")
            : handlers.notify("Ese enlace no es de un vídeo de YouTube."),
        );
      },
    });
    group.addItem("emoji", {
      label: "Emoji",
      icon: emojiIcon,
      onRun: (ctx) => {
        clearSlash(ctx);
        handlers.requestEmoji(caret(ctx), (emoji) => insertText(ctx, emoji));
      },
    });
    group.addItem("page-icon", {
      label: "Icono de la página",
      icon: pageEmojiIcon,
      onRun: (ctx) => {
        clearSlash(ctx);
        handlers.requestEmoji(caret(ctx), handlers.setPageIcon);
      },
    });
    group.addItem("cover", {
      label: "Portada",
      icon: coverIcon,
      onRun: (ctx) => {
        clearSlash(ctx);
        handlers.addCover();
      },
    });
    group.addItem("embed", {
      label: "Incrustar nota",
      icon: embedIcon,
      onRun: (ctx) => {
        clearSlash(ctx);
        handlers.requestLink((target) => insertEmbed(ctx, target));
      },
    });
    group.addItem("database-view", {
      label: "Vista de base de datos",
      icon: dbViewIcon,
      onRun: (ctx) => {
        clearSlash(ctx);
        handlers.requestDatabase((folder) => insertEmbed(ctx, `${folder}/`));
      },
    });
    group.addItem("property", {
      label: "Propiedad",
      icon: propertyIcon,
      onRun: (ctx) => {
        clearSlash(ctx);
        handlers.addProperty();
      },
    });
    group.addItem("database", {
      label: "Base de datos",
      icon: databaseIcon,
      onRun: (ctx) => {
        clearSlash(ctx);
        handlers.createDatabase();
      },
    });
    group.addItem("template", {
      label: "Plantilla",
      icon: templateIcon,
      onRun: (ctx) => {
        clearSlash(ctx);
        handlers.requestTemplate((markdown) => {
          insert(markdown)(ctx);
          ctx.get(editorViewCtx).focus();
        });
      },
    });
    for (const [type, { label }] of Object.entries(CALLOUT_TYPES)) {
      group.addItem(`callout-${type}`, {
        label: `Aviso: ${label.toLowerCase()}`,
        icon: calloutIcon,
        onRun: (ctx) => {
          clearSlash(ctx);
          insertCallout(ctx, type as CalloutType, "");
        },
      });
    }
    group.addItem("toggle", {
      label: "Desplegable",
      icon: toggleIcon,
      onRun: (ctx) => {
        clearSlash(ctx);
        insertCallout(ctx, "note", "-");
      },
    });
    group.addItem("toc", {
      label: "Índice",
      icon: tocIcon,
      onRun: (ctx) => {
        clearSlash(ctx);
        const markdown = tocMarkdown(ctx);
        if (markdown) insert(markdown)(ctx);
        else handlers.notify("El índice usa los títulos de nivel 2 o más; esta nota aún no tiene.");
      },
    });
    group.addItem("highlight", {
      label: "Resaltar",
      icon: highlightIcon,
      onRun: (ctx) => {
        clearSlash(ctx);
        // Texto de ejemplo ya resaltado y seleccionado, para escribir encima.
        const view = ctx.get(editorViewCtx);
        const text = "texto resaltado";
        const { from } = view.state.selection;
        const tr = view.state.tr.insert(
          from,
          view.state.schema.text(text, [highlightSchema.type(ctx).create()]),
        );
        view.dispatch(tr.setSelection(TextSelection.create(tr.doc, from, from + text.length)));
        view.focus();
      },
    });
    group.addItem("diagram", {
      label: "Diagrama",
      icon: diagramIcon,
      onRun: (ctx) => {
        clearSlash(ctx);
        insert("```mermaid\nflowchart LR\n  Idea --> Nota --> Proyecto\n```")(ctx);
      },
    });
    group.addItem("export-pdf", {
      label: "Exportar a PDF",
      icon: icon('<path d="M6 3h9l4 4v14H6z"/><path d="M12 10v7M9 14l3 3 3-3"/>'),
      onRun: (ctx) => {
        clearSlash(ctx);
        handlers.exportNote("pdf");
      },
    });
    group.addItem("export-html", {
      label: "Exportar a HTML",
      icon: icon('<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>'),
      onRun: (ctx) => {
        clearSlash(ctx);
        handlers.exportNote("html");
      },
    });
    group.addItem("today", {
      label: "Fecha de hoy",
      icon: dateIcon,
      onRun: (ctx) => {
        clearSlash(ctx);
        insertText(ctx, today());
      },
    });
    group.addItem("now", {
      label: "Hora actual",
      icon: timeIcon,
      onRun: (ctx) => {
        clearSlash(ctx);
        insertText(ctx, nowTime());
      },
    });
  };
}
