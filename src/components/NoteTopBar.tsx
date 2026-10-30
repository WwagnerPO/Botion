import { ChevronRight, FileText, History, MoreHorizontal, Share, Star } from "lucide-react";

interface Props {
  path: string;
  icon: string | null;
  status: string;
  isDatabase: (folder: string) => boolean;
  onOpenDatabase: (folder: string) => void;
  onExport: (e: React.MouseEvent<HTMLButtonElement>) => void;
  favorite: boolean;
  onToggleFavorite: () => void;
  onHistory: () => void;
  /** Menú «…» de la página (estilo, índice, sin distracciones). */
  onMore: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** En modo sin distracciones la barra solo se ve al pasar el ratón. */
  focus: boolean;
}

/** Barra fija sobre la nota: dónde está, si se ha guardado y exportar. */
export function NoteTopBar({
  path,
  icon,
  status,
  isDatabase,
  onOpenDatabase,
  onExport,
  favorite,
  onToggleFavorite,
  onHistory,
  onMore,
  focus,
}: Props) {
  const iconButton =
    "grid size-7 shrink-0 place-items-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-100";
  const parts = path.split("/");
  const name = parts.pop()!.replace(/\.md$/i, "");

  return (
    <div
      className={`no-print sticky top-0 z-20 flex h-11 items-center gap-2 bg-white/90 px-3 text-sm backdrop-blur transition-opacity dark:bg-neutral-950/90 ${
        focus ? "opacity-0 hover:opacity-100 focus-within:opacity-100" : ""
      }`}
    >
      <nav aria-label="Ubicación" className="flex min-w-0 flex-1 items-center gap-0.5 text-neutral-500">
        {parts.map((part, i) => {
          const folder = parts.slice(0, i + 1).join("/");
          const db = isDatabase(folder);
          return (
            <span key={folder} className="flex min-w-0 shrink items-center gap-0.5">
              {db ? (
                <button
                  type="button"
                  onClick={() => onOpenDatabase(folder)}
                  className="truncate rounded-md px-1.5 py-0.5 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                >
                  {part}
                </button>
              ) : (
                <span className="truncate px-1.5 py-0.5">{part}</span>
              )}
              <ChevronRight className="size-3.5 shrink-0 text-neutral-300 dark:text-neutral-600" />
            </span>
          );
        })}
        <span className="flex min-w-0 items-center gap-1.5 px-1.5 py-0.5 text-neutral-800 dark:text-neutral-100">
          {icon ? (
            <span className="text-base leading-none">{icon}</span>
          ) : (
            <FileText className="size-4 shrink-0 text-neutral-400" strokeWidth={1.75} />
          )}
          <span className="truncate">{name}</span>
        </span>
      </nav>
      <span aria-live="polite" className="shrink-0 text-xs text-neutral-400">
        {status}
      </span>
      <button type="button" onClick={onHistory} className={iconButton} title="Historial de versiones" aria-label="Historial de versiones">
        <History className="size-4" />
      </button>
      <button
        type="button"
        onClick={onToggleFavorite}
        className={iconButton}
        title={favorite ? "Quitar de favoritas" : "Añadir a favoritas"}
        aria-label={favorite ? "Quitar de favoritas" : "Añadir a favoritas"}
        aria-pressed={favorite}
      >
        <Star className={`size-4 ${favorite ? "fill-amber-400 text-amber-400" : ""}`} />
      </button>
      <button
        type="button"
        onClick={onExport}
        className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        title="Exportar"
      >
        <Share className="size-4" />
        Exportar
      </button>
      <button type="button" onClick={onMore} className={iconButton} title="Estilo y vista de la página" aria-label="Más opciones de la página">
        <MoreHorizontal className="size-4" />
      </button>
    </div>
  );
}
