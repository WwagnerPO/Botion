import { inferKind, type Kind, type PropValue, type Props } from "../lib/database";
import { PropertyInput } from "./PropertyInput";

interface Props_ {
  path: string;
  props: Props;
  /** Tipos de las columnas si la nota está en una base de datos. */
  kinds: Record<string, Kind>;
  /** Valores usados en la base de datos, para sugerirlos. */
  options: Record<string, string[]>;
  onChange: (key: string, value: PropValue) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
}

/** Propiedades de la nota (su frontmatter), encima del editor. */
export function PropertiesPanel({
  path,
  props,
  kinds,
  options,
  onChange,
  onRemove,
  onAdd,
}: Props_) {
  const entries = Object.entries(props);
  if (entries.length === 0) return null;

  return (
    <div className="mx-14 mb-6 border-b border-neutral-200 pb-3 dark:border-neutral-800">
      {entries.map(([key, value]) => (
        <div key={key} className="group flex items-center gap-2 text-sm">
          <span className="w-36 shrink-0 truncate text-neutral-500" title={key}>
            {key}
          </span>
          <div className="min-w-0 flex-1">
            <PropertyInput
              id={`${path}-${key}`}
              kind={kinds[key] ?? inferKind(value)}
              value={value}
              options={options[key]}
              onChange={(v) => onChange(key, v)}
              alignNumbers={false}
            />
          </div>
          <button
            type="button"
            onClick={() => onRemove(key)}
            className="invisible rounded px-1 text-neutral-400 group-hover:visible hover:text-red-500"
            aria-label={`Quitar ${key}`}
            title="Quitar propiedad"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="no-print mt-1 rounded px-1 text-sm text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
      >
        + Añadir propiedad
      </button>
    </div>
  );
}
