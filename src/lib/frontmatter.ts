const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)(?:[ \t]*\r?\n)*/;

/**
 * Separa el frontmatter YAML del cuerpo de la nota. El editor solo trabaja
 * con el cuerpo; el frontmatter se conserva tal cual al guardar.
 */
export function splitFrontmatter(content: string): {
  frontmatter: string;
  body: string;
} {
  const match = content.match(FRONTMATTER);
  if (!match) return { frontmatter: "", body: content };
  return { frontmatter: match[0], body: content.slice(match[0].length) };
}

export function joinFrontmatter(frontmatter: string, body: string): string {
  if (!frontmatter) return body;
  const sep = /\n\s*\n$/.test(frontmatter) ? "" : "\n";
  return frontmatter + sep + body;
}
