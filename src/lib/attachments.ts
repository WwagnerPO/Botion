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

/** Abre el diálogo del sistema para elegir un fichero. */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    // Dentro del documento: algunos motores (WebKit) no abren el diálogo
    // de un campo suelto.
    const input = document.createElement("input");
    input.type = "file";
    if (accept) input.accept = accept;
    input.hidden = true;
    const done = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    input.onchange = () => done(input.files?.[0] ?? null);
    input.oncancel = () => done(null);
    document.body.append(input);
    input.click();
  });
}

/** Abre una nota o adjunto de la bóveda con el programa del sistema. */
export function openInSystem(path: string) {
  return invoke<void>("open_in_system", { path });
}

/** Muestra una ruta de la bóveda en el explorador de archivos. */
export function revealInSystem(path: string) {
  return invoke<void>("reveal_in_system", { path });
}

const MEDIA: Record<string, "video" | "audio"> = {
  mp4: "video", webm: "video", mov: "video", m4v: "video", ogv: "video",
  mp3: "audio", wav: "audio", ogg: "audio", m4a: "audio", flac: "audio", aac: "audio",
};

/**
 * Tipo de una incrustación `![[destino]]` que no es una nota: vídeo, audio u
 * otro fichero (PDF, hoja de cálculo...). `null` si es una nota.
 */
export function fileKind(target: string): "video" | "audio" | "file" | null {
  const ext = /\.([a-z0-9]+)$/i.exec(target)?.[1]?.toLowerCase();
  if (!ext || ext === "md") return null;
  return MEDIA[ext] ?? "file";
}

/**
 * Ruta en la bóveda de un adjunto incrustado. Como en Obsidian, un nombre
 * sin carpeta se busca en `adjuntos/`.
 */
export function attachmentPath(target: string) {
  return target.includes("/") ? target : `adjuntos/${target}`;
}

/** Enlace relativo que devuelve `saveAttachment` → ruta en la bóveda. */
export function linkToVaultPath(link: string) {
  return `adjuntos/${decodeURI(link).split("/").pop()}`;
}

/** Identificador de un vídeo de YouTube, o `null`. */
export function youtubeId(url: string) {
  const m =
    /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i.exec(
      url,
    );
  return m?.[1] ?? null;
}
