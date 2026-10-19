import { nowTime, today } from "./slashCommands";
import type { TreeNode } from "./vault";

/** Carpeta de la bóveda donde viven las plantillas (notas normales). */
export const TEMPLATES_FOLDER = "Plantillas";

/** Plantilla de ejemplo que se crea si aún no hay ninguna. */
export const EXAMPLE_TEMPLATE = {
  name: "Reunión",
  content: `---
tipo: Reunión
fecha: {{fecha}}
---

# {{titulo}}

## Asistentes

- Nombre

## Notas

Resumen de la reunión.

## Tareas

- [ ] Primera tarea
`,
};

export function listTemplates(tree: TreeNode[]): { path: string; name: string }[] {
  const folder = tree.find(
    (n) => n.kind === "folder" && n.path === TEMPLATES_FOLDER,
  );
  if (!folder || folder.kind !== "folder") return [];
  const out: { path: string; name: string }[] = [];
  const walk = (nodes: TreeNode[]) =>
    nodes.forEach((n) =>
      n.kind === "folder" ? walk(n.children) : out.push({ path: n.path, name: n.name }),
    );
  walk(folder.children);
  return out.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Sustituye `{{titulo}}`, `{{fecha}}` y `{{hora}}` (sin distinguir mayúsculas). */
export function applyVariables(text: string, vars: { title: string }) {
  const values: Record<string, string> = {
    titulo: vars.title,
    título: vars.title,
    fecha: today(),
    hora: nowTime(),
  };
  return text.replace(/\{\{\s*([\p{L}]+)\s*\}\}/gu, (match, name: string) =>
    values[name.toLowerCase()] ?? match,
  );
}
