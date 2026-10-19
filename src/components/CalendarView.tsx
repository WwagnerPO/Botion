import { useState } from "react";
import type { Column, Database, PropValue, Props, Row } from "../lib/database";
import { today } from "../lib/slashCommands";

interface Props_ {
  db: Database;
  rows: Row[];
  onOpenNote: (path: string) => void;
  onChangeValue: (rowPath: string, column: string, value: PropValue) => void;
  onNewRow: (preset: Props) => void;
  onDateBy: (column: string) => void;
}

const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

export function dateColumns(columns: Column[]) {
  return columns.filter((c) => c.kind === "date");
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Días que se ven en el mes: semanas completas de lunes a domingo. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((((first.getDay() + 6) % 7) + daysInMonth) / 7);
  return Array.from(
    { length: weeks * 7 },
    (_, i) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  );
}

/** Vista calendario: cada nota en el día de una propiedad de fecha. */
export function CalendarView({
  db,
  rows,
  onOpenNote,
  onChangeValue,
  onNewRow,
  onDateBy,
}: Props_) {
  const now = new Date();
  const [month, setMonth] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [dragOver, setDragOver] = useState<string | null>(null);
  const candidates = dateColumns(db.columns);
  const column = candidates.find((c) => c.name === db.date_by) ?? candidates[0];

  if (!column) {
    return (
      <p className="text-sm text-neutral-500">
        Añade una propiedad de tipo Fecha para ver las notas en el calendario.
      </p>
    );
  }

  const days = monthGrid(month.year, month.month);
  const byDay = new Map<string, Row[]>();
  let undated = 0;
  for (const row of rows) {
    const v = row.props[column.name];
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      undated++;
      continue;
    }
    byDay.set(v, [...(byDay.get(v) ?? []), row]);
  }

  const monthName = new Date(month.year, month.month, 1).toLocaleDateString(
    "es-ES",
    { month: "long", year: "numeric" },
  );
  // «octubre de 2026» → «Octubre de 2026».
  const title = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const move = (delta: number) =>
    setMonth(({ year, month: m }) => {
      const d = new Date(year, m + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  const todayIso = today();

  function drop(e: React.DragEvent, day: string) {
    e.preventDefault();
    setDragOver(null);
    const path = e.dataTransfer.getData("text/x-botion-row");
    if (
      path &&
      rows.find((r) => r.path === path)?.props[column!.name] !== day
    ) {
      onChangeValue(path, column!.name, day);
    }
  }

  const navButton =
    "rounded px-2 py-0.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="min-w-40 text-lg font-semibold">{title}</h2>
        <button
          type="button"
          className={navButton}
          onClick={() => move(-1)}
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <button
          type="button"
          className={navButton}
          onClick={() =>
            setMonth({ year: now.getFullYear(), month: now.getMonth() })
          }
        >
          Hoy
        </button>
        <button
          type="button"
          className={navButton}
          onClick={() => move(1)}
          aria-label="Mes siguiente"
        >
          ›
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-neutral-500">
          Fecha
          <select
            value={column.name}
            onChange={(e) => onDateBy(e.target.value)}
            className="rounded border border-neutral-200 bg-transparent px-1.5 py-0.5 dark:border-neutral-700"
          >
            {candidates.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-7 border-t border-l border-neutral-200 text-sm dark:border-neutral-800">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="border-r border-b border-neutral-200 px-2 py-1 text-xs text-neutral-400 dark:border-neutral-800"
          >
            {d}
          </div>
        ))}
        {days.map((date) => {
          const day = iso(date);
          const inMonth = date.getMonth() === month.month;
          return (
            <div
              key={day}
              data-day={day}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(day);
              }}
              onDragLeave={() => setDragOver((d) => (d === day ? null : d))}
              onDrop={(e) => drop(e, day)}
              className={`group min-h-24 border-r border-b border-neutral-200 p-1 dark:border-neutral-800 ${
                dragOver === day
                  ? "bg-violet-100 dark:bg-violet-950"
                  : inMonth
                    ? ""
                    : "bg-neutral-50 dark:bg-neutral-900/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`px-1 text-xs ${
                    day === todayIso
                      ? "rounded-full bg-red-500 font-semibold text-white"
                      : inMonth
                        ? "text-neutral-500"
                        : "text-neutral-300 dark:text-neutral-600"
                  }`}
                >
                  {date.getDate()}
                </span>
                <button
                  type="button"
                  onClick={() => onNewRow({ [column.name]: day })}
                  className="invisible rounded px-1 text-xs text-neutral-400 group-hover:visible hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  aria-label={`Nueva nota el ${day}`}
                >
                  +
                </button>
              </div>
              <ul className="mt-1 space-y-1">
                {(byDay.get(day) ?? []).map((row) => (
                  <li
                    key={row.path}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/x-botion-row", row.path);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenNote(row.path)}
                      className="block w-full cursor-grab truncate rounded bg-violet-100 px-1.5 py-0.5 text-left text-xs text-violet-900 hover:bg-violet-200 dark:bg-violet-900/50 dark:text-violet-100"
                    >
                      {row.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {undated > 0 && (
        <p className="mt-2 text-xs text-neutral-400">
          {undated} {undated === 1 ? "nota sin fecha" : "notas sin fecha"} (se
          ven en la tabla).
        </p>
      )}
    </div>
  );
}
