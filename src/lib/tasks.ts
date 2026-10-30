import { invoke } from "@tauri-apps/api/core";
import { toggleTaskLine } from "./recurrence";
import { today } from "./slashCommands";
import { readNote, writeNote } from "./vault";

/** Tarea con fecha de alguna nota (`- [ ] texto 📅 2026-10-31`). */
export interface Task {
  path: string;
  /** Línea (desde 0) dentro del fichero. */
  line: number;
  text: string;
  done: boolean;
  due: string | null;
  /** `2026-10-31` o `2026-10-31 09:00`. */
  remind: string | null;
  repeat: string | null;
}

export function listTasks(): Promise<Task[]> {
  return invoke<Task[]>("list_tasks");
}

/** Marca o desmarca una tarea en su nota (y crea la siguiente si se repite). */
export async function setTaskDone(task: Task, done: boolean) {
  const content = await readNote(task.path);
  const lines = content.split("\n");
  const line = lines[task.line];
  if (line === undefined || !line.includes(task.text)) {
    throw new Error("La tarea ha cambiado en la nota; vuelve a abrir la lista.");
  }
  lines.splice(task.line, 1, ...toggleTaskLine(line, done));
  await writeNote(task.path, lines.join("\n"));
}

/** Momento de un recordatorio; sin hora, a las 9:00. */
export function reminderTime(remind: string) {
  const [date, time = "09:00"] = remind.split(" ");
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min);
}

export type Bucket = "overdue" | "today" | "week" | "later";

export const BUCKET_LABELS: Record<Bucket, string> = {
  overdue: "Vencidas",
  today: "Hoy",
  week: "Próximos 7 días",
  later: "Más adelante",
};

/** Fecha de la tarea: el vencimiento o, si no tiene, el día del recordatorio. */
export const taskDate = (t: Task) => t.due ?? t.remind!.slice(0, 10);

export function bucketOf(t: Task, now = new Date()): Bucket {
  const d = taskDate(t);
  const day = today(now);
  if (d < day) return "overdue";
  if (d === day) return "today";
  const week = today(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));
  return d <= week ? "week" : "later";
}

const FIRED_KEY = "botion:recordatorios";

/**
 * Recordatorios que ya tocan y aún no se han avisado. Los de hace más de
 * 12 horas (la app estaba cerrada) se dan por vistos sin avisar.
 */
export function dueReminders(tasks: Task[], now = new Date()): Task[] {
  let fired: string[] = [];
  try {
    fired = JSON.parse(localStorage.getItem(FIRED_KEY) ?? "[]");
  } catch {
    // Sin almacenamiento local se avisa una vez por sesión.
  }
  const seen = new Set(fired);
  const out: Task[] = [];
  for (const t of tasks) {
    if (t.done || !t.remind) continue;
    const key = `${t.path}|${t.text}|${t.remind}`;
    const when = reminderTime(t.remind).getTime();
    if (when > now.getTime() || seen.has(key)) continue;
    seen.add(key);
    fired.push(key);
    if (now.getTime() - when < 12 * 3_600_000) out.push(t);
  }
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(fired.slice(-500)));
  } catch {
    // Igual que arriba.
  }
  return out;
}

/** Aviso del sistema (si lo permite) para un recordatorio. */
export async function notify(title: string, body: string) {
  try {
    const n = await import("@tauri-apps/plugin-notification");
    let granted = await n.isPermissionGranted();
    if (!granted) granted = (await n.requestPermission()) === "granted";
    if (granted) n.sendNotification({ title, body });
  } catch {
    // Sin notificaciones del sistema queda el aviso dentro de la app.
  }
}
