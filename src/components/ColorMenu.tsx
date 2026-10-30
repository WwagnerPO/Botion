import { COLORS, COLOR_NAMES } from "../lib/colors";
import { Popover } from "./Popover";

interface Props {
  anchor: DOMRect;
  onClose: () => void;
  /** `null` quita el color. */
  onPick: (patch: { color?: string | null; background?: string | null }) => void;
}

const swatch =
  "grid size-7 place-items-center rounded-md border border-neutral-200 text-sm font-semibold hover:ring-2 hover:ring-violet-400 dark:border-neutral-700";

/** Colores de texto y de fondo de la paleta de Notion. */
export function ColorMenu({ anchor, onClose, onPick }: Props) {
  const pick = (patch: Parameters<Props["onPick"]>[0]) => {
    onPick(patch);
    onClose();
  };
  return (
    <Popover anchor={anchor} onClose={onClose} className="w-[19.5rem] p-2">
      <p className="px-0.5 pb-1 text-xs text-neutral-400">Color del texto</p>
      <div className="mb-2 flex flex-wrap gap-1">
        <button type="button" className={swatch} onClick={() => pick({ color: null })} title="Sin color" aria-label="Texto sin color">
          A
        </button>
        {COLOR_NAMES.map((c) => (
          <button
            key={c}
            type="button"
            className={swatch}
            data-color={c}
            onClick={() => pick({ color: COLORS[c].text })}
            title={COLORS[c].label}
            aria-label={`Texto ${COLORS[c].label.toLowerCase()}`}
          >
            A
          </button>
        ))}
      </div>
      <p className="px-0.5 pb-1 text-xs text-neutral-400">Fondo</p>
      <div className="flex flex-wrap gap-1">
        <button type="button" className={swatch} onClick={() => pick({ background: null })} title="Sin fondo" aria-label="Sin fondo">
          ∅
        </button>
        {COLOR_NAMES.map((c) => (
          <button
            key={c}
            type="button"
            className={swatch}
            data-bg={c}
            onClick={() => pick({ background: COLORS[c].bg })}
            title={COLORS[c].label}
            aria-label={`Fondo ${COLORS[c].label.toLowerCase()}`}
          />
        ))}
      </div>
    </Popover>
  );
}
