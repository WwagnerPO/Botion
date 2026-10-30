import { AlarmClock, CalendarClock, CheckSquare, Repeat, X } from "lucide-react";
import { useState } from "react";
import { formatDate } from "../lib/naturalDate";
import { BUCKET_LABELS, bucketOf, taskDate, type Bucket, type Task } from "../lib/tasks";

interface Props {
  tasks: Task[];
  iconOf: (path: string) => string | undefined;
  onToggle: (task: Task, done: boolean) => void;
  onOpen: (path: string) => void;
  onClose: () => void;
}

const ORDER: Bucket[] = ["overdue", "today", "week", "later"];
const noteName = (p: string) => p.split("/").pop()!.replace(/\.md$/i, "");

/** Tareas con fecha de toda la bóveda: vencidas, hoy, próximas y más adelante. */
export function TasksPanel({ tasks, iconOf, onToggle, onOpen, onClose }: Props) {
  const [showDone, setShowDone] = useState(false);
  const shown = tasks
    .filter((t) => showDone || !t.done)
    .sort((a, b) => taskDate(a).localeCompare(taskDate(b)) || (a.remind ?? "").localeCompare(b.remind ?? ""));
  const pending = tasks.filter((t) => !t.done).length;

  return (
    <aside
      role="dialog"
      aria-label="Tareas"
      className="fixed top-0 right-0 bottom-0 z-30 flex w-[min(440px,94vw)] animate-pop flex-col border-l border-neutral-200 bg-white shadow-pop dark:border-neutral-800 dark:bg-neutral-950"
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-neutral-100 px-3 text-sm font-medium dark:border-neutral-800">
        <CheckSquare className="size-4 text-violet-500" /> Tareas
        <span className="font-normal text-neutral-400">{pending} pendientes</span>
        <label className="ml-auto flex items-center gap-1.5 text-xs font-normal text-neutral-500">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-violet-600" />
          Ver hechas
        </label>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar tareas"
          className="grid size-7 place-items-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-6">
        {shown.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-neutral-400">
            No hay tareas con fecha. Escribe «/Fecha de vencimiento» o «/Recordatorio» en una tarea (- [ ]).
          </p>
        )}
        {ORDER.map((bucket) => {
          const list = shown.filter((t) => bucketOf(t) === bucket);
          if (list.length === 0) return null;
          return (
            <section key={bucket} aria-label={BUCKET_LABELS[bucket]}>
              <h3
                className={`px-2 pt-4 pb-1 text-xs font-medium ${
                  bucket === "overdue" ? "text-red-500" : bucket === "today" ? "text-orange-500" : "text-neutral-400"
                }`}
              >
                {BUCKET_LABELS[bucket]} · {list.length}
              </h3>
              <ul>
                {list.map((t) => {
                  const icon = iconOf(t.path);
                  return (
                    <li key={`${t.path}:${t.line}`} className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800/70">
                      <input
                        type="checkbox"
                        checked={t.done}
                        onChange={(e) => onToggle(t, e.target.checked)}
                        aria-label={`Marcar «${t.text}»`}
                        className="mt-1 accent-violet-600"
                      />
                      <button type="button" onClick={() => onOpen(t.path)} className="min-w-0 flex-1 text-left text-sm">
                        <span className={t.done ? "text-neutral-400 line-through" : "text-neutral-800 dark:text-neutral-100"}>
                          {t.text || "(sin texto)"}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-neutral-400">
                          <span className="truncate">
                            {icon ? `${icon} ` : ""}
                            {noteName(t.path)}
                          </span>
                          {t.due && (
                            <span className="flex items-center gap-1">
                              <CalendarClock className="size-3" /> {formatDate(t.due)}
                            </span>
                          )}
                          {t.remind && (
                            <span className="flex items-center gap-1">
                              <AlarmClock className="size-3" />
                              {t.remind.length > 10 ? t.remind.slice(11) : "9:00"}
                              {t.remind.slice(0, 10) !== t.due ? ` · ${formatDate(t.remind.slice(0, 10))}` : ""}
                            </span>
                          )}
                          {t.repeat && (
                            <span className="flex items-center gap-1">
                              <Repeat className="size-3" /> {t.repeat}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
