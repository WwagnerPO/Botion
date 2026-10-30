import { ImageIcon, Smile, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { COVERS, coverBackground } from "../lib/cover";
import { randomIcon } from "../lib/emoji";
import { EmojiPicker } from "./EmojiPicker";

interface Props {
  icon: string | null;
  cover: string | null;
  vaultRoot: string;
  notePath: string;
  onIcon: (icon: string | null) => void;
  onCover: (cover: string | null) => void;
  /** Elige una imagen, la guarda en `adjuntos/` y devuelve su enlace. */
  onUploadCover: () => Promise<string | null>;
  /** Página a ancho completo. */
  wide?: boolean;
}

const ghost =
  "flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300";

const onCoverButton =
  "flex items-center gap-1 rounded-md bg-white/85 px-2 py-1 text-xs text-neutral-700 shadow-sm backdrop-blur hover:bg-white dark:bg-neutral-900/80 dark:text-neutral-200 dark:hover:bg-neutral-900";

/** Portada e icono de la nota (propiedades `portada` e `icono`). */
export function PageHeader({
  icon,
  cover,
  vaultRoot,
  notePath,
  onIcon,
  onCover,
  onUploadCover,
  wide,
}: Props) {
  const [picker, setPicker] = useState<{ x: number; y: number } | null>(null);
  const [covers, setCovers] = useState<{ x: number; y: number } | null>(null);

  const openPicker = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPicker({ x: r.left, y: r.bottom + 6 });
  };
  const openCovers = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    setCovers({ x: r.left, y: r.bottom + 6 });
  };

  return (
    <div className="group/header">
      {cover && (
        <div
          className="relative h-52 w-full"
          style={{ background: coverBackground(cover, vaultRoot, notePath) }}
          data-testid="note-cover"
        >
          <div className="no-print absolute right-4 bottom-3 flex gap-1 opacity-0 transition-opacity group-hover/header:opacity-100">
            <button type="button" onClick={openCovers} className={onCoverButton}>
              <ImageIcon className="size-3.5" /> Cambiar portada
            </button>
            <button
              type="button"
              onClick={() => onCover(null)}
              className={onCoverButton}
              aria-label="Quitar portada"
              title="Quitar portada"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      )}
      <div className={`mx-auto w-full px-14 ${wide ? "max-w-none" : "max-w-3xl"}`}>
        {icon && (
          <button
            type="button"
            onClick={openPicker}
            className={`relative block rounded-lg text-[64px] leading-none hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
              cover ? "-mt-10" : "mt-2"
            }`}
            aria-label="Cambiar icono"
            title="Cambiar icono"
          >
            <span className="block p-1">{icon}</span>
          </button>
        )}
        <div
          className={`no-print flex gap-1 opacity-0 transition-opacity group-hover/header:opacity-100 focus-within:opacity-100 ${
            icon ? "mt-1" : cover ? "mt-3" : "mt-0"
          }`}
        >
          {!icon && (
            <button type="button" onClick={() => onIcon(randomIcon())} className={ghost}>
              <Smile className="size-4" /> Añadir icono
            </button>
          )}
          {!cover && (
            <button type="button" onClick={openCovers} className={ghost}>
              <ImageIcon className="size-4" /> Añadir portada
            </button>
          )}
        </div>
      </div>

      {picker && (
        <EmojiPicker
          {...picker}
          onPick={onIcon}
          onRemove={() => onIcon(null)}
          onClose={() => setPicker(null)}
        />
      )}
      {covers && (
        <CoverMenu
          {...covers}
          onPick={onCover}
          onUpload={async () => {
            const link = await onUploadCover();
            if (link) onCover(link);
          }}
          onClose={() => setCovers(null)}
        />
      )}
    </div>
  );
}

function CoverMenu({
  x,
  y,
  onPick,
  onUpload,
  onClose,
}: {
  x: number;
  y: number;
  onPick: (cover: string) => void;
  onUpload: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onClose} />
      <div
        role="dialog"
        aria-label="Elegir portada"
        style={{ left: Math.min(x, window.innerWidth - 300), top: y }}
        className="fixed z-50 w-72 animate-pop rounded-xl bg-white p-3 shadow-pop dark:bg-neutral-800"
      >
        <p className="mb-2 text-xs font-medium text-neutral-400">Colores</p>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(COVERS).map(([name, background]) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                onClose();
                onPick(name);
              }}
              title={name}
              aria-label={`Portada ${name}`}
              className="h-10 rounded-md ring-offset-2 hover:ring-2 hover:ring-violet-400 dark:ring-offset-neutral-800"
              style={{ background }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            onClose();
            onUpload();
          }}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-neutral-200 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-700"
        >
          <Upload className="size-4" /> Subir imagen
        </button>
      </div>
    </>
  );
}
