import { inferKind, type Kind, type PropValue, type Props } from "../lib/database";
import { Plus, X } from "lucide-react";
import { KIND_ICONS } from "./kindIcons";
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
  /** Base de datos de cada propiedad de tipo relación. */
  relations?: Record<string, string>;
  onOpenLink?: (target: string) => void;
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
  relations = {},
  onOpenLink,
}: Props_) {
  const entries = Object.entries(props);
  if (entries.length === 0) return null;

  return (
    <div className="mx-14 mb-6 border-b border-neutral-200 pb-3 dark:border-neutral-800">
      {entries.map(([key, value]) => {
        const kind = kinds[key] ?? inferKind(value);
        const Icon = KIND_ICONS[kind];
        return (
        <div key={key} className="group flex min-h-8 items-center gap-2 rounded-md text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900">
          <span className="flex w-40 shrink-0 items-center gap-2 truncate px-1.5 text-neutral-500" title={key}>
            <Icon className="size-4 shrink-0 text-neutral-400" strokeWidth={1.75} />
            <span className="truncate">{key}</span>
          </span>
          <div className="min-w-0 flex-1">
            <PropertyInput
              id={`${path}-${key}`}
              kind={kind}
              value={value}
              options={options[key]}
              onChange={(v) => onChange(key, v)}
              alignNumbers={false}
              notePath={path}
              relation={relations[key]}
              onOpenLink={onOpenLink}
            />
          </div>
          <button
            type="button"
            onClick={() => onRemove(key)}
            className="invisible mr-1 grid size-6 place-items-center rounded text-neutral-400 group-hover:visible hover:bg-neutral-200/70 hover:text-red-500 dark:hover:bg-neutral-800"
            aria-label={`Quitar ${key}`}
            title="Quitar propiedad"
          >
            <X className="size-3.5" />
          </button>
        </div>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        className="no-print mt-1 flex items-center gap-2 rounded-md px-1.5 py-1 text-sm text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
      >
        <Plus className="size-4" /> Añadir propiedad
      </button>
    </div>
  );
}
