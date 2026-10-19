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
const databaseIcon = icon(
  '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
);

/** Quita el «/texto» que se ha escrito para abrir el menú. */
function clearSlash(ctx: Ctx) {
  ctx.get(commandsCtx).call(clearTextInCurrentBlockCommand.key);
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
  const start = $from.before();
  const tr = state.tr.replaceRangeWith(start, $from.after(), node);
  const cursor = fold ? start + 2 : start + 1 + title.nodeSize + 1;
  view.dispatch(tr.setSelection(TextSelection.create(tr.doc, cursor)).scrollIntoView());
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
