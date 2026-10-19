import { describe, expect, it } from "vitest";
import { checkFormula, runFormula, text, type FValue } from "./formula";

const props: Record<string, FValue> = {
  precio: 12.5,
  cantidad: 4,
  hecha: true,
  estado: "En curso",
  fin: new Date(2026, 9, 30),
  etiquetas: ["casa", "web"],
  vacio: null,
};
const run = (src: string) =>
  runFormula(src, { prop: (n) => props[n] ?? null, now: new Date(2026, 9, 19, 10, 30) });

describe("fórmulas", () => {
  it("operadores y precedencia", () => {
    expect(run('prop("precio") * prop("cantidad")')).toBe(50);
    expect(run("1 + 2 * 3")).toBe(7);
    expect(run("(1 + 2) * 3")).toBe(9);
    expect(run("-2 * 3")).toBe(-6);
    expect(run("10 % 4")).toBe(2);
    expect(text(run("0.1 + 0.2"))).toBe("0.3");
    expect(run('"a" + 1')).toBe("a1");
    expect(run("2 > 1 && 1 >= 1")).toBe(true);
    expect(run("1 == 2 or 3 != 4")).toBe(true);
    expect(run("not true")).toBe(false);
    expect(run("1 = 1")).toBe(true);
  });

  it("condiciones y texto", () => {
    expect(run('if(prop("hecha"), "✅", "⏳")')).toBe("✅");
    expect(run('si(prop("vacio"), "sí", "no")')).toBe("no");
    expect(run('concat(prop("estado"), "!")')).toBe("En curso!");
    expect(run('upper(prop("estado"))')).toBe("EN CURSO");
    expect(run('contains(prop("etiquetas"), "web")')).toBe(true);
    expect(run('contains(prop("estado"), "curso")')).toBe(true);
    expect(run('length(prop("etiquetas"))')).toBe(2);
    expect(run('join(prop("etiquetas"), " / ")')).toBe("casa / web");
    expect(run('empty(prop("vacio"))')).toBe(true);
    expect(run('replaceAll("a-b-c", "-", "+")')).toBe("a+b+c");
  });

  it("números", () => {
    expect(run("round(3.14159, 2)")).toBe(3.14);
    expect(run("max(1, 5, 3)")).toBe(5);
    expect(run("sum(1, 2, 3)")).toBe(6);
    expect(run("average(2, 4)")).toBe(3);
    expect(run('toNumber("4,5")')).toBe(4.5);
  });

  it("fechas", () => {
    expect(run('dateBetween(prop("fin"), today(), "days")')).toBe(11);
    expect(run('dateBetween(prop("fin"), today(), "días")')).toBe(11);
    expect(text(run('dateAdd(prop("fin"), 2, "days")'))).toBe("2026-11-01");
    expect(run('formatDate(prop("fin"))')).toBe("30 oct 2026");
    expect(run('formatDate(prop("fin"), "DD/MM/YYYY")')).toBe("30/10/2026");
    expect(run('year(prop("fin")) + month(prop("fin"))')).toBe(2036);
    expect(run('prop("fin") > today()')).toBe(true);
    expect(text(run("now()"))).toBe("2026-10-19 10:30");
    expect(run('weekday(today())')).toBe(1);
  });

  it("errores en español", () => {
    expect(checkFormula("1 +")).toMatch(/incompleta/);
    expect(checkFormula('prop("a"')).toMatch(/Se esperaba/);
    expect(checkFormula("estado")).toMatch(/prop\("estado"\)/);
    expect(checkFormula('"abc')).toMatch(/comillas/);
    expect(checkFormula('prop("a") + 1')).toBeNull();
    expect(() => run("noexiste(1)")).toThrow(/No existe la función/);
    expect(() => run("1 / 0")).toThrow(/cero/);
    expect(() => run('round("hola")')).toThrow(/no es un número/);
  });
});
