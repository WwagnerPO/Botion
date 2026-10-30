/**
 * Botones dentro de una nota: un bloque de código `boton` con líneas
 * `clave: valor`. Al pulsarlo crea una fila en una base de datos.
 *
 * ```boton
 * texto: Nueva tarea
 * base: Tareas
 * plantilla: Tarea
 * abrir: sí
 * estado: Pendiente
 * ```
 *
 * Las claves que no son del botón se ponen como propiedades de la fila.
 */

export interface ButtonSpec {
  label: string;
  database: string | null;
  template: string | null;
  open: boolean;
  props: Record<string, string | number | boolean>;
}

const yes = (v: string) => /^(si|sí|true|yes|1)$/i.test(v.trim());

export function parseButton(source: string): ButtonSpec {
  const spec: ButtonSpec = { label: "Botón", database: null, template: null, open: false, props: {} };
  for (const line of source.split("\n")) {
    const i = line.indexOf(":");
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    switch (key.toLowerCase()) {
      case "texto":
      case "text":
        spec.label = value || spec.label;
        break;
      case "base":
      case "database":
        spec.database = value || null;
        break;
      case "plantilla":
      case "template":
        spec.template = value || null;
        break;
      case "abrir":
      case "open":
        spec.open = yes(value);
        break;
      default:
        if (!key) break;
        spec.props[key] =
          value === "true" || value === "false"
            ? value === "true"
            : value !== "" && Number.isFinite(Number(value))
              ? Number(value)
              : value;
    }
  }
  return spec;
}

/** Markdown de un botón nuevo para una base de datos. */
export function buttonMarkdown(database: string) {
  const name = database.split("/").pop();
  return `\`\`\`boton\ntexto: Nueva fila en ${name}\nbase: ${database}\nabrir: sí\n\`\`\``;
}
