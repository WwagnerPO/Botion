import { describe, expect, it } from "vitest";
import { blockText, ensureBlockId, listBlocks, replaceBlock, sectionText, splitTarget } from "./blockRefs";
import { highlightsMarkdown, parseHighlights, sidecarPath } from "./pdfHighlights";

const NOTE = `---
tipo: x
---
# Título

Primera línea
del párrafo ^p1

- Uno ^li1
- Dos

## Otra

Fin.
`;

describe("bloques sincronizados", () => {
  it("lee destinos", () => {
    expect(splitTarget("Nota#^p1")).toEqual({ note: "Nota", block: "p1", section: null });
    expect(splitTarget("Nota#Otra")).toEqual({ note: "Nota", block: null, section: "Otra" });
    expect(splitTarget("Nota")).toEqual({ note: "Nota", block: null, section: null });
  });
  it("lee y cambia bloques", () => {
    expect(blockText(NOTE, "p1")).toBe("Primera línea\ndel párrafo");
    expect(blockText(NOTE, "li1")).toBe("- Uno");
    expect(blockText(NOTE, "no")).toBeNull();
    const changed = replaceBlock(NOTE, "p1", "Nuevo texto")!;
    expect(changed).toContain("\nNuevo texto ^p1\n\n- Uno ^li1");
    expect(changed).not.toContain("Primera línea");
  });
  it("secciones", () => {
    expect(sectionText(NOTE, "otra")).toBe("## Otra\n\nFin.\n");
  });
  it("lista bloques y pone identificadores", () => {
    expect(listBlocks(NOTE).map((b) => [b.line, b.text, b.id])).toEqual([
      [6, "del párrafo", "p1"],
      [8, "Uno", "li1"],
      [9, "Dos", null],
      [13, "Fin.", null],
    ]);
    const { content, id } = ensureBlockId(NOTE, 9);
    expect(content).toContain(`- Dos ^${id}\n`);
    expect(ensureBlockId(NOTE, 8).id).toBe("li1");
  });
});


describe("subrayados de PDF", () => {
  it("guarda y lee", () => {
    const list = [
      { id: "b", page: 2, text: "Segundo «dato»", rects: [[0.1, 0.5, 0.3, 0.02]] as [number, number, number, number][] },
      { id: "a", page: 1, text: "Primero\nen dos líneas", rects: [[0.123456, 0.2, 0.5, 0.02], [0.1, 0.22, 0.2, 0.02]] as [number, number, number, number][] },
    ];
    const md = highlightsMarkdown(null, "adjuntos/informe.pdf", list);
    expect(sidecarPath("adjuntos/informe.pdf")).toBe("adjuntos/informe (subrayados).md");
    expect(md).toBe(
      "# Subrayados de informe.pdf\n\nPDF: [[adjuntos/informe.pdf]]\n\n" +
        "- p. 1 · «Primero en dos líneas» %%0.1235,0.2,0.5,0.02;0.1,0.22,0.2,0.02%% ^a\n" +
        '- p. 2 · «Segundo «dato"» %%0.1,0.5,0.3,0.02%% ^b\n',
    );
    const back = parseHighlights(md);
    expect(back.map((h) => [h.id, h.page, h.rects.length])).toEqual([["a", 1, 2], ["b", 2, 1]]);
    // Lo escrito a mano se conserva al volver a guardar.
    const edited = md.replace("PDF:", "Mis notas.\n\nPDF:");
    expect(highlightsMarkdown(edited, "adjuntos/informe.pdf", back.slice(0, 1))).toContain("Mis notas.");
    expect(parseHighlights(highlightsMarkdown(edited, "adjuntos/informe.pdf", back.slice(0, 1)))).toHaveLength(1);
  });
});
