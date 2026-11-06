// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { htmlToNote, noteName } from "./clip";

const long = "Texto de la versión con bastantes palabras para que cuente como contenido principal. ".repeat(4);

describe("htmlToNote", () => {
  it("prefiere el cuerpo Markdown frente al resto de la página (GitHub)", () => {
    const html = `<html><head><title>Release v1</title></head><body>
      <main>
        <h2>Choose a tag to compare</h2>
        <template><h3>Sorry, something went wrong.</h3></template>
        <div hidden>Loading</div>
        <span class="Label">Latest</span>
        <div class="markdown-body"><h3>Editor</h3><p>${long}</p><ul><li>uno</li></ul></div>
        <dialog><h3>Uh oh!</h3></dialog>
      </main></body></html>`;
    const { markdown } = htmlToNote(html, "https://github.com/a/b/releases/tag/v1");
    expect(markdown).toContain("### Editor");
    expect(markdown).not.toMatch(/^- {2,}/m);
    expect(markdown).not.toContain("Choose a tag");
    expect(markdown).not.toContain("Latest");
    expect(markdown).not.toContain("Sorry");
    expect(markdown).not.toContain("Uh oh");
  });

  it("quita elementos ocultos y menús dentro del artículo", () => {
    const html = `<body><article><p>${long}</p><div hidden>oculto</div><div role="menu">menú</div></article></body>`;
    const { markdown } = htmlToNote(html, "https://ejemplo.com/a");
    expect(markdown).not.toContain("oculto");
    expect(markdown).not.toContain("menú");
  });

  it("enlaces con la dirección completa", () => {
    const html = `<body><article><p>${long} <a href="/otra">otra</a></p></article></body>`;
    expect(htmlToNote(html, "https://ejemplo.com/a/b").markdown).toContain("(https://ejemplo.com/otra)");
  });
});

describe("noteName", () => {
  it("quita caracteres no válidos", () => {
    expect(noteName('Hola: "mundo" / #1')).toBe("Hola mundo 1");
  });
});
