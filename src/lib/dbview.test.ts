import { describe, expect, it } from "vitest";
import { newView, type Database, type Row } from "./database";
import { cell, groupRows, matches, relatedRows, total, viewRows, type Ctx } from "./dbview";

const row = (name: string, props: Row["props"], folder = "Tareas"): Row => ({
  path: `${folder}/${name}.md`,
  name,
  subfolder: "",
  props,
  error: null,
  created: new Date(2026, 9, 1, 9, 0).getTime(),
  modified: new Date(2026, 9, 18, 17, 5).getTime(),
});

const proyectos: Database = {
  path: "Proyectos",
  name: "Proyectos",
  columns: [{ name: "horas", kind: "number" }],
  views: [newView("table")],
  active_view: null,
  subfolders: false,
  rows: [row("Web", { horas: 10 }, "Proyectos"), row("App", { horas: 5 }, "Proyectos")],
};

const tareas: Database = {
  path: "Tareas",
  name: "Tareas",
  columns: [
    { name: "estado", kind: "select" },
    { name: "precio", kind: "number" },
    { name: "fecha", kind: "date" },
    { name: "hecha", kind: "checkbox" },
    { name: "etiquetas", kind: "tags" },
    { name: "proyectos", kind: "relation", relation: "Proyectos" },
    { name: "total", kind: "formula", formula: 'prop("precio") * 2' },
    { name: "mal", kind: "formula", formula: 'prop("noexiste")' },
    { name: "horas", kind: "rollup", rollup: { relation: "proyectos", property: "horas", function: "sum" } },
    { name: "creada", kind: "created" },
  ],
  views: [newView("table")],
  active_view: null,
  subfolders: false,
  rows: [
    row("Pan", { estado: "Hecho", precio: 2, fecha: "2026-10-18", hecha: true, etiquetas: ["casa"] }),
    row("Bici", { estado: "En curso", precio: 30, fecha: "2026-10-25", etiquetas: ["casa", "taller"], proyectos: ["[[Web]]", "[[App|la app]]"] }),
    row("Banco", { precio: 5 }),
  ],
};

const ctx: Ctx = { db: tareas, related: { Proyectos: proyectos }, now: new Date(2026, 9, 19) };
const col = (name: string) => tareas.columns.find((c) => c.name === name)!;
const names = (rows: Row[]) => rows.map((r) => r.name);

describe("columnas calculadas", () => {
  it("fórmula, rollup, relación y fechas del fichero", () => {
    expect(cell(tareas.rows[1], col("total"), ctx).value).toBe(60);
    expect(cell(tareas.rows[0], col("mal"), ctx).error).toMatch(/noexiste/);
    expect(cell(tareas.rows[1], col("horas"), ctx).value).toBe(15);
    expect(cell(tareas.rows[0], col("horas"), ctx).value).toBe(0);
    expect(cell(tareas.rows[0], col("creada"), ctx).value).toBe("2026-10-01 09:00");
    expect(names(relatedRows(tareas.rows[1].props.proyectos, proyectos))).toEqual(["Web", "App"]);
  });
});

describe("filtros", () => {
  it("operadores por tipo", () => {
    expect(matches("Hecho", { column: "", op: "is", value: "hecho" })).toBe(true);
    expect(matches(["casa", "taller"], { column: "", op: "contains", value: "Taller" })).toBe(true);
    expect(matches(["[[Web]]"], { column: "", op: "contains", value: "web" })).toBe(true);
    expect(matches(30, { column: "", op: "gt", value: "10" })).toBe(true);
    expect(matches(null, { column: "", op: "gt", value: "10" })).toBe(false);
    expect(matches(null, { column: "", op: "empty", value: null })).toBe(true);
    expect(matches("2026-10-18", { column: "", op: "before", value: "2026-10-19" })).toBe(true);
    expect(matches("2026-10-19 08:00", { column: "", op: "today", value: null }, new Date(2026, 9, 19))).toBe(true);
    expect(matches("2026-10-25", { column: "", op: "next_week", value: null }, new Date(2026, 9, 19))).toBe(true);
    expect(matches("Canción", { column: "", op: "contains", value: "cancion" })).toBe(true);
  });

  it("vista con filtros, búsqueda y orden", () => {
    const view = { ...newView("table"), filters: [{ column: "etiquetas", op: "contains", value: "casa" }], sort: { column: "precio", desc: true } };
    expect(names(viewRows(view, ctx))).toEqual(["Bici", "Pan"]);
    expect(names(viewRows(view, ctx, "pan"))).toEqual(["Pan"]);
    const byFormula = { ...newView("table"), filters: [{ column: "total", op: "gt", value: 5 }] };
    expect(names(viewRows(byFormula, ctx))).toEqual(["Bici", "Banco"]);
    const gone = { ...newView("table"), filters: [{ column: "borrada", op: "is", value: "x" }] };
    expect(viewRows(gone, ctx)).toHaveLength(3);
  });
});

describe("grupos y totales", () => {
  it("agrupa por selección y por etiquetas", () => {
    const g = groupRows(tareas.rows, col("estado"), ctx).map((x) => [x.key, names(x.rows)]);
    expect(g).toEqual([["En curso", ["Bici"]], ["Hecho", ["Pan"]], [null, ["Banco"]]]);
    const t = groupRows(tareas.rows, col("etiquetas"), ctx).map((x) => [x.key, x.rows.length]);
    expect(t).toEqual([["casa", 2], ["taller", 1], [null, 1]]);
  });

  it("totales", () => {
    expect(total("sum", [2, 30, 5])).toBe("37");
    expect(total("average", [2, 30, null])).toBe("16");
    expect(total("median", [1, 3, 2, 10])).toBe("2,5");
    expect(total("count_empty", ["a", null, ""])).toBe("2");
    expect(total("percent_checked", [true, false, true, null])).toBe("50 %");
    expect(total("latest", ["2026-10-18", "2026-10-25", null])).toBe("2026-10-25");
  });
});
