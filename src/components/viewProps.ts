import type { Column, Database, PropValue, Props, Row, ViewConfig } from "../lib/database";
import type { Ctx } from "../lib/dbview";

/** Lo que reciben todas las vistas de una base de datos. */
export interface ViewProps {
  db: Database;
  view: ViewConfig;
  /** Filas ya filtradas y ordenadas. */
  rows: Row[];
  ctx: Ctx;
  /** Columnas visibles en la vista, en orden. */
  columns: Column[];
  options: Record<string, string[]>;
  vaultRoot: string;
  /** Abre la nota como página. */
  onOpenNote: (path: string) => void;
  /** Abre el destino de un enlace `[[…]]` (relaciones). */
  onOpenLink: (target: string) => void;
  /** Abre la nota en el panel lateral. */
  onPeek: (path: string) => void;
  onChangeValue: (rowPath: string, column: string, value: PropValue) => void | Promise<void>;
  onNewRow: (preset: Props) => void;
  onUpdateView: (patch: Partial<ViewConfig>) => void;
  /** Color de la fila según el formato condicional, o `null`. */
  tintOf: (row: Row) => string | null;
}
