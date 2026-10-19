import { convertFileSrc, invoke } from "@tauri-apps/api/core";

/**
 * Guarda un fichero en la carpeta `adjuntos/` de la bóveda y devuelve el
 * enlace relativo a la nota (`../adjuntos/foto.png`).
 */
export async function saveAttachment(notePath: string, file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return invoke<string>("save_attachment", bytes, {
    headers: {
      "x-note": encodeURIComponent(notePath),
      "x-name": encodeURIComponent(file.name || "imagen.png"),
    },
  });
}

/** Une rutas con «/» resolviendo «..» y «.». */
function joinPath(...parts: string[]) {
  const out: string[] = [];
  for (const part of parts.join("/").split(/[\\/]+/)) {
    if (part === "..") out.pop();
    else if (part && part !== ".") out.push(part);
  }
  return out.join("/");
}

/**
 * URL para mostrar una imagen de la nota: las web se dejan igual; las
 * relativas se buscan desde la carpeta de la nota dentro de la bóveda.
 */
export function displayUrl(url: string, vaultRoot: string, notePath: string) {
  if (/^(https?:|data:|blob:|asset:)/i.test(url)) return url;
  const folder = notePath.split("/").slice(0, -1).join("/");
  const relative = joinPath(folder, decodeURI(url));
  // La raíz es una ruta del sistema (en Windows con «C:\»): se respeta tal cual.
  const root = vaultRoot.replace(/[\\/]+$/, "");
  const sep = root.includes("\\") ? "\\" : "/";
  return convertFileSrc(root + sep + relative.split("/").join(sep));
}
