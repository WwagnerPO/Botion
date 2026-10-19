import { commandsCtx } from "@milkdown/kit/core";
import { toggleMark } from "@milkdown/kit/prose/commands";
import { InputRule } from "@milkdown/kit/prose/inputrules";
import { $command, $inputRule, $markSchema, $remark, $useKeymap } from "@milkdown/kit/utils";

/**
 * Texto resaltado con la sintaxis de Obsidian: `==texto==`. Se ve con fondo
 * amarillo y se guarda tal cual.
 */

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
}

const HIGHLIGHT = /==([^=\n](?:[^\n]*?[^=\n])?)==/g;

function split(node: MdNode): MdNode[] {
  const text = node.value ?? "";
  const out: MdNode[] = [];
  let last = 0;
  for (const m of text.matchAll(HIGHLIGHT)) {
    if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
    out.push({ type: "highlight", children: [{ type: "text", value: m[1] }] });
    last = m.index + m[0].length;
  }
  if (out.length === 0) return [node];
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

function transform(node: MdNode) {
  if (!node.children) return;
  node.children = node.children.flatMap((child) => {
    if (child.type === "text") return split(child);
    transform(child);
    return [child];
  });
}

type PhrasingState = {
  containerPhrasing: (node: MdNode, info: Record<string, unknown>) => string;
};

function remarkHighlight(this: { data: () => Record<string, unknown[] | undefined> }) {
  const data = this.data();
  (data.toMarkdownExtensions ??= []).push({
    handlers: {
      highlight: (node: MdNode, _parent: unknown, state: PhrasingState, info: Record<string, unknown>) =>
        `==${state.containerPhrasing(node, { ...info, before: "=", after: "=" })}==`,
    },
  });
  return (tree: MdNode) => transform(tree);
}

// Los tipos de unified no encajan con un plugin escrito a mano.
export const highlightRemark = $remark("highlight", () => remarkHighlight as never);

export const highlightSchema = $markSchema("highlight", () => ({
  parseDOM: [{ tag: "mark" }],
  toDOM: () => ["mark", { class: "highlight" }, 0],
  parseMarkdown: {
    match: (node) => node.type === "highlight",
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === "highlight",
    runner: (state, mark) => {
      state.withMark(mark, "highlight");
    },
  },
}));

/** Al escribir `==texto==` se resalta. */
export const highlightInputRule = $inputRule(
  (ctx) =>
    new InputRule(/==([^=\n]+)==$/, (state, match, start, end) => {
      const type = highlightSchema.type(ctx);
      return state.tr
        .replaceWith(start, end, state.schema.text(match[1], [type.create()]))
        .removeStoredMark(type);
    }),
);

export const toggleHighlightCommand = $command(
  "ToggleHighlight",
  (ctx) => () => toggleMark(highlightSchema.type(ctx)),
);

/** Ctrl/Cmd + Mayús + H. */
export const highlightKeymap = $useKeymap("highlightKeymap", {
  ToggleHighlight: {
    shortcuts: "Mod-Shift-h",
    command: (ctx) => {
      const commands = ctx.get(commandsCtx);
      return () => commands.call(toggleHighlightCommand.key);
    },
  },
});

export const highlight = [
  highlightRemark,
  highlightSchema,
  highlightInputRule,
  toggleHighlightCommand,
  highlightKeymap,
].flat();
