import { FileText } from "lucide-react";
import { useState } from "react";
import { COMPUTED_KINDS, type Row } from "../lib/database";
import { valueOf } from "../lib/dbview";
import { parseDate } from "../lib/formula";
import { ICON_KEY } from "../lib/cover";
import type { ViewProps } from "./viewProps";

const DAY = 34;
const NAME = 220;
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayIndex = (d: Date, from: Date) => Math.round((addDays(d, 0).getTime() - from.getTime()) / 864e5);
const WEEKDAYS = ["D", "L", "M", "X", "J", "V", "S"];

/**
 * Cronograma: una barra por nota entre su fecha de inicio y la de fin (o un
 * solo día). Las barras se arrastran para moverlas, y su borde derecho para
 * cambiar el fin.
 */
export function TimelineView({ db, view, rows, ctx, onPeek, onChangeValue }: ViewProps) {
  const now = new Date();
  const [month, setMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [drag, setDrag] = useState<{ path: string; mode: "move" | "end"; delta: number } | null>(null);

  const dates = db.columns.filter((c) => ["date", "created", "edited", "formula"].includes(c.kind));
  const start = dates.find((c) => c.name === view.date_by) ?? dates.find((c) => c.kind === "date") ?? dates[0];
  const end = view.end_by ? db.columns.find((c) => c.name === view.end_by) : undefined;

  if (!start) {
    return <p className="text-sm text-neutral-500">Añade una propiedad de tipo Fecha para ver las notas en el cronograma.</p>;
  }

  const from = new Date(month.year, month.month, 1);
  const days = new Date(month.year, month.month + 1, 0).getDate();
  const to = addDays(from, days - 1);
  const todayIndex = dayIndex(new Date(now.getFullYear(), now.getMonth(), now.getDate()), from);
  const monthName = from.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const title = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const spans = rows.map((row) => {
    const s = parseDate(String(valueOf(row, start.name, ctx) ?? ""));
    const eRaw = end ? parseDate(String(valueOf(row, end.name, ctx) ?? "")) : null;
    const s0 = s && new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const e0 = eRaw && s0 && eRaw >= s0 ? new Date(eRaw.getFullYear(), eRaw.getMonth(), eRaw.getDate()) : s0;
    return { row, s: s0, e: e0 };
  });
  const visible = spans.filter((x) => x.s && x.e && x.e >= from && x.s <= to);
  const undated = spans.filter((x) => !x.s).length;
  const canMove = !COMPUTED_KINDS.has(start.kind);
  const canResize = !!end && !COMPUTED_KINDS.has(end.kind);

  function startDrag(row: Row, s: Date, e: Date, mode: "move" | "end", ev: React.PointerEvent) {
    if (mode === "move" ? !canMove : !canResize) return;
    ev.preventDefault();
    ev.stopPropagation();
    const x0 = ev.clientX;
    let delta = 0;
    let moved = false;
    const move = (pe: PointerEvent) => {
      delta = Math.round((pe.clientX - x0) / DAY);
      if (Math.abs(pe.clientX - x0) > 3) moved = true;
      setDrag({ path: row.path, mode, delta });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDrag(null);
      if (!moved) return mode === "move" && onPeek(row.path);
      if (delta === 0) return;
      if (mode === "move") {
        // Una tras otra: las dos escriben en la misma nota.
        const moveBoth = async () => {
          await onChangeValue(row.path, start!.name, iso(addDays(s, delta)));
          if (canResize && end && e.getTime() !== s.getTime()) await onChangeValue(row.path, end.name, iso(addDays(e, delta)));
        };
        void moveBoth();
      } else {
        const ne = addDays(e, delta);
        onChangeValue(row.path, end!.name, iso(ne < s ? s : ne));
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const nav = (delta: number) =>
    setMonth(({ year, month: m }) => {
      const d = new Date(year, m + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  const navButton = "rounded-md px-2 py-0.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800";

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="min-w-44 text-lg font-semibold">{title}</h2>
        <button type="button" className={navButton} onClick={() => nav(-1)} aria-label="Mes anterior">‹</button>
        <button type="button" className={navButton} onClick={() => setMonth({ year: now.getFullYear(), month: now.getMonth() })}>Hoy</button>
        <button type="button" className={navButton} onClick={() => nav(1)} aria-label="Mes siguiente">›</button>
        <span className="ml-auto text-xs text-neutral-400">
          {start.name}
          {end ? ` → ${end.name}` : ""}
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <div style={{ width: NAME + days * DAY }} className="relative text-sm">
          <div className="flex border-b border-neutral-200 dark:border-neutral-800">
            <div style={{ width: NAME }} className="sticky left-0 z-10 shrink-0 bg-white px-3 py-1.5 text-xs text-neutral-400 dark:bg-neutral-950">
              Nota
            </div>
            {Array.from({ length: days }, (_, i) => {
              const d = addDays(from, i);
              const weekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div
                  key={i}
                  style={{ width: DAY }}
                  className={`shrink-0 py-1 text-center text-[11px] leading-tight ${weekend ? "bg-neutral-50 text-neutral-400 dark:bg-neutral-900/60" : "text-neutral-500"}`}
                >
                  <div>{WEEKDAYS[d.getDay()]}</div>
                  <div className={i === todayIndex ? "mx-auto w-5 rounded-full bg-violet-600 font-semibold text-white" : ""}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>
          {visible.length === 0 && <p className="px-3 py-6 text-center text-neutral-400">No hay notas con fecha este mes.</p>}
          {visible.map(({ row, s, e }) => {
            const d = drag?.path === row.path ? drag : null;
            const s1 = d?.mode === "move" ? addDays(s!, d.delta) : s!;
            let e1 = d ? addDays(e!, d.delta) : e!;
            if (d?.mode === "end" && e1 < s1) e1 = s1;
            const a = Math.max(0, dayIndex(s1, from));
            const b = Math.min(days - 1, dayIndex(e1, from));
            const icon = row.props[ICON_KEY];
            return (
              <div key={row.path} className="relative flex h-9 items-center border-b border-neutral-100 last:border-b-0 dark:border-neutral-800/70">
                <button
                  type="button"
                  onClick={() => onPeek(row.path)}
                  style={{ width: NAME }}
                  className="sticky left-0 z-10 flex h-full shrink-0 items-center gap-2 truncate bg-white px-3 text-left hover:underline dark:bg-neutral-950"
                >
                  {typeof icon === "string" ? icon : <FileText className="size-4 shrink-0 text-neutral-400" strokeWidth={1.75} />}
                  <span className="truncate">{row.name}</span>
                </button>
                {todayIndex >= 0 && todayIndex < days && (
                  <span className="absolute top-0 bottom-0 w-px bg-violet-400/50" style={{ left: NAME + todayIndex * DAY + DAY / 2 }} />
                )}
                {b >= a && (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`${row.name}: ${iso(s1)} – ${iso(e1)}`}
                    onPointerDown={(ev) => startDrag(row, s!, e!, "move", ev)}
                    onKeyDown={(ev) => ev.key === "Enter" && onPeek(row.path)}
                    className={`absolute flex h-6 items-center truncate rounded-md bg-violet-100 px-2 text-xs font-medium text-violet-900 shadow-[0_0_0_1px_rgb(139_92_246/0.35)] dark:bg-violet-900/60 dark:text-violet-100 ${canMove ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                    style={{ left: NAME + a * DAY + 2, width: (b - a + 1) * DAY - 4 }}
                  >
                    <span className="truncate">{row.name}</span>
                    {canResize && (
                      <span
                        onPointerDown={(ev) => startDrag(row, s!, e!, "end", ev)}
                        className="absolute top-0 right-0 h-full w-2 cursor-ew-resize rounded-r-md hover:bg-violet-400/40"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {undated > 0 && (
        <p className="mt-2 text-xs text-neutral-400">
          {undated} {undated === 1 ? "nota sin fecha" : "notas sin fecha"}.
        </p>
      )}
    </div>
  );
}
