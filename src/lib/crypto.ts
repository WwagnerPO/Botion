/**
 * Notas cifradas con contraseña (AES-GCM, clave derivada con PBKDF2). El
 * texto de la nota se guarda como un bloque de código `botion-cifrado`; las
 * propiedades (frontmatter) quedan sin cifrar.
 */

const ITERATIONS = 310_000;
const BLOCK = /```botion-cifrado\n([A-Za-z0-9+/=\s]+?)\n```/;
const NOTICE = "> 🔒 Nota cifrada con Botion. Ábrela en Botion con su contraseña.";

export interface NoteKey {
  key: CryptoKey;
  salt: Uint8Array;
}

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (text: string) => Uint8Array.from(atob(text.replace(/\s+/g, "")), (c) => c.charCodeAt(0));

export function isEncrypted(body: string) {
  return BLOCK.test(body);
}

async function derive(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Clave nueva (con sal nueva) para cifrar una nota. */
export async function newKey(password: string): Promise<NoteKey> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { key: await derive(password, salt), salt };
}

/** Cifra el texto: devuelve el cuerpo de la nota que se guarda en disco. */
export async function encryptBody(text: string, k: NoteKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k.key, new TextEncoder().encode(text)));
  const payload = toB64(new TextEncoder().encode(JSON.stringify({ v: 1, salt: toB64(k.salt), iv: toB64(iv), data: toB64(data) })));
  const lines = payload.match(/.{1,76}/g)!.join("\n");
  return `${NOTICE}\n\n\`\`\`botion-cifrado\n${lines}\n\`\`\`\n`;
}

/**
 * Descifra el cuerpo con la contraseña. Devuelve el texto y la clave (para
 * volver a cifrar al guardar sin derivarla otra vez).
 */
export async function decryptBody(body: string, password: string): Promise<{ text: string; key: NoteKey }> {
  const m = BLOCK.exec(body);
  if (!m) throw new Error("La nota no está cifrada");
  let payload: { v: number; salt: string; iv: string; data: string };
  try {
    payload = JSON.parse(new TextDecoder().decode(fromB64(m[1])));
  } catch {
    throw new Error("El bloque cifrado está dañado");
  }
  const salt = fromB64(payload.salt);
  const key = await derive(password, salt);
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(payload.iv) as BufferSource }, key, fromB64(payload.data) as BufferSource);
    return { text: new TextDecoder().decode(plain), key: { key, salt } };
  } catch {
    throw new Error("Contraseña incorrecta");
  }
}

/** Descifra con una clave ya derivada (la de la sesión). Falla si la nota se cifró con otra sal. */
export async function decryptWithKey(body: string, k: NoteKey): Promise<string> {
  const m = BLOCK.exec(body);
  if (!m) throw new Error("La nota no está cifrada");
  const payload = JSON.parse(new TextDecoder().decode(fromB64(m[1]))) as { salt: string; iv: string; data: string };
  if (payload.salt !== toB64(k.salt)) throw new Error("Otra contraseña");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(payload.iv) as BufferSource }, k.key, fromB64(payload.data) as BufferSource);
  return new TextDecoder().decode(plain);
}
