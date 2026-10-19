/** Vista previa de los bloques de código ```mermaid (se carga al usarla). */

let counter = 0;

export function renderMermaidPreview(
  language: string,
  content: string,
  applyPreview: (value: null | string | HTMLElement) => void,
) {
  if (language.toLowerCase() !== "mermaid") return null;
  const code = content.trim();
  if (!code) return null;

  import("mermaid")
    .then(async ({ default: mermaid }) => {
      const dark = document.documentElement.classList.contains("dark");
      mermaid.initialize({
        startOnLoad: false,
        theme: dark ? "dark" : "default",
        securityLevel: "strict",
      });
      const { svg } = await mermaid.render(`botion-mermaid-${++counter}`, code);
      applyPreview(svg);
    })
    .catch((e) => {
      const error = document.createElement("div");
      error.className = "mermaid-error";
      error.textContent = `Diagrama no válido: ${e instanceof Error ? e.message : String(e)}`;
      applyPreview(error);
    });
  // Mientras se carga, Milkdown muestra el texto de «cargando».
  return undefined;
}
