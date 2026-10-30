import { describe, expect, it } from "vitest";
import { parseNaturalDate } from "./naturalDate";
import { nextDate, shiftedDates, toggleTaskLine } from "./recurrence";
import { parseButton } from "./button";

// Viernes 30 de octubre de 2026, 10:00.
const now = new Date(2026, 9, 30, 10, 0);

describe("fechas en lenguaje natural", () => {
  const p = (q: string) => parseNaturalDate(q, now);
  it("días relativos", () => {
    expect(p("hoy")?.date).toBe("2026-10-30");
    expect(p("Mañana")?.date).toBe("2026-10-31");
    expect(p("pasado mañana")?.date).toBe("2026-11-01");
    expect(p("ayer")?.date).toBe("2026-10-29");
    expect(p("dentro de 3 días")?.date).toBe("2026-11-02");
    expect(p("en una semana")?.date).toBe("2026-11-06");
    expect(p("dentro de dos meses")?.date).toBe("2026-12-30");
    expect(p("la semana que viene")?.date).toBe("2026-11-06");
    expect(p("fin de mes")?.date).toBe("2026-10-31");
  });
  it("días de la semana", () => {
    expect(p("el sábado")?.date).toBe("2026-10-31");
    expect(p("lunes")?.date).toBe("2026-11-02");
    expect(p("el viernes")?.date).toBe("2026-11-06");
    expect(p("este viernes")?.date).toBe("2026-10-30");
    expect(p("este fin de semana")?.date).toBe("2026-10-31");
    expect(p("el próximo miércoles")?.date).toBe("2026-11-04");
  });
  it("fechas con mes y hora", () => {
    expect(p("15 de noviembre")).toEqual({ date: "2026-11-15", time: null });
    expect(p("3 de enero")?.date).toBe("2027-01-03");
    expect(p("15/11/2027")?.date).toBe("2027-11-15");
    expect(p("2026-12-24")?.date).toBe("2026-12-24");
    expect(p("mañana a las 9")).toEqual({ date: "2026-10-31", time: "09:00" });
    expect(p("sábado a las 6 de la tarde")).toEqual({ date: "2026-10-31", time: "18:00" });
    expect(p("15 nov 18:30")).toEqual({ date: "2026-11-15", time: "18:30" });
    expect(p("a las 17:15")).toEqual({ date: "2026-10-30", time: "17:15" });
  });
  it("no inventa", () => {
    expect(p("reunión con Ana")).toBeNull();
    expect(p("31 de febrero")).toBeNull();
    expect(p("")).toBeNull();
  });
});

describe("repeticiones", () => {
  it("siguiente fecha", () => {
    expect(nextDate("2026-10-31", "cada día")).toBe("2026-11-01");
    expect(nextDate("2026-10-31", "cada semana")).toBe("2026-11-07");
    expect(nextDate("2026-01-31", "cada mes")).toBe("2026-02-28");
    expect(nextDate("2026-10-31", "cada 2 semanas")).toBe("2026-11-14");
    expect(nextDate("2026-10-30", "cada día laborable")).toBe("2026-11-02");
    expect(nextDate("2026-10-30", "cada lunes y jueves")).toBe("2026-11-02");
    expect(nextDate("2026-10-30", "every week")).toBe("2026-11-06");
    expect(nextDate("2026-10-30", "cuando sea")).toBeNull();
  });
  it("mueve vencimiento y recordatorio", () => {
    expect(shiftedDates("Pagar 📅 2026-10-31 ⏰ 2026-10-30 09:00 🔁 cada mes", "cada mes")).toEqual([
      { from: "📅 2026-10-31", to: "📅 2026-11-30" },
      { from: "⏰ 2026-10-30", to: "⏰ 2026-11-29" },
    ]);
  });
  it("marcar una tarea que se repite crea la siguiente", () => {
    expect(toggleTaskLine("- [ ] Regar 📅 2026-10-30 🔁 cada semana", true, "2026-10-30")).toEqual([
      "- [ ] Regar 📅 2026-11-06 🔁 cada semana",
      "- [x] Regar 📅 2026-10-30 🔁 cada semana ✅ 2026-10-30",
    ]);
    expect(toggleTaskLine("  * [x] Hecha 📅 2026-10-30 ✅ 2026-10-30", false)).toEqual(["  * [ ] Hecha 📅 2026-10-30"]);
    expect(toggleTaskLine("- [ ] Sola 📅 2026-10-30\r", true, "2026-10-31")).toEqual(["- [x] Sola 📅 2026-10-30 ✅ 2026-10-31\r"]);
  });
});


describe("botones", () => {
  it("lee el bloque", () => {
    expect(parseButton("texto: Nueva tarea\nbase: Tareas\nplantilla: Tarea\nabrir: sí\nestado: Pendiente\nhoras: 2\nurgente: true\n")).toEqual({
      label: "Nueva tarea",
      database: "Tareas",
      template: "Tarea",
      open: true,
      props: { estado: "Pendiente", horas: 2, urgente: true },
    });
  });
});
