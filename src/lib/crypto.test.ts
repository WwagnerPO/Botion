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

import { findConflicts, keepBothName } from "./syncConflicts";

describe("conflictos de sincronización", () => {
  it("reconoce las copias", () => {
    expect(
      findConflicts([
        "Ideas.md",
        "Ideas.sync-conflict-20261104-101500-ABCD123.md",
        "A/Plan (conflicted copy 2026-11-04).md",
        "A/Plan (copia en conflicto de Ana).md",
        "Diario (conflicto WebDAV 2).md",
        "Lista (remoto).md",
        "Receta (1).md",
      ]),
    ).toEqual([
      { copy: "Ideas.sync-conflict-20261104-101500-ABCD123.md", original: "Ideas.md", source: "Syncthing" },
      { copy: "A/Plan (conflicted copy 2026-11-04).md", original: "A/Plan.md", source: "la nube" },
      { copy: "A/Plan (copia en conflicto de Ana).md", original: "A/Plan.md", source: "la nube" },
      { copy: "Diario (conflicto WebDAV 2).md", original: "Diario.md", source: "WebDAV" },
      { copy: "Lista (remoto).md", original: "Lista.md", source: "Git" },
    ]);
    expect(keepBothName("A/Plan.md")).toBe("Plan (otra versión)");
  });
});
