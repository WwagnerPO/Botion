import { describe, expect, it } from "vitest";
import { decryptBody, encryptBody, isEncrypted, newKey } from "./crypto";
import { noteName } from "./clip";

describe("notas cifradas", () => {
  it("cifra y descifra", async () => {
    const k = await newKey("secreta");
    const body = await encryptBody("# Diario\n\nMi secreto con tildes: ñ 🚀\n", k);
    expect(isEncrypted(body)).toBe(true);
    expect(body).not.toContain("secreto");
    expect((await decryptBody(body, "secreta")).text).toBe("# Diario\n\nMi secreto con tildes: ñ 🚀\n");
    await expect(decryptBody(body, "otra")).rejects.toThrow("Contraseña incorrecta");
    // Cada guardado usa un vector nuevo: el mismo texto no se repite.
    expect(await encryptBody("x", k)).not.toBe(await encryptBody("x", k));
  });
});

describe("recortes", () => {
  it("nombre de nota a partir del título", () => {
    expect(noteName("Cómo hacer pan: guía / 2026 | Blog")).toBe("Cómo hacer pan guía 2026 Blog");
    expect(noteName("   ")).toBe("Página sin título");
    expect(noteName("...oculto")).toBe("oculto");
  });
});
