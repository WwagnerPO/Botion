import { writeNote } from "./vault";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Guarda una nota unos instantes después del último cambio, para no
 * escribir en disco con cada tecla.
 */
export class Autosaver {
  private pending: { path: string; content: string } | null = null;
  private timer: number | undefined;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private onStatus: (status: SaveStatus, error?: string) => void,
    private delay = 500,
  ) {}

  schedule(path: string, content: string) {
    if (this.pending && this.pending.path !== path) void this.flush();
    this.pending = { path, content };
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.flush(), this.delay);
  }

  /** Guarda ya lo que quede pendiente. */
  flush(): Promise<void> {
    window.clearTimeout(this.timer);
    const job = this.pending;
    this.pending = null;
    if (!job) return this.queue;

    // Las escrituras van en cola para que nunca se pisen entre sí.
    this.queue = this.queue.then(async () => {
      this.onStatus("saving");
      try {
        await writeNote(job.path, job.content);
        this.onStatus("saved");
      } catch (e) {
        this.onStatus("error", String(e));
      }
    });
    return this.queue;
  }
}
