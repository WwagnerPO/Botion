import { ArrowDown, ArrowUp, EyeOff, Filter as FilterIcon, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  KIND_LABELS,
  type Column,
  type Database,
  type Kind,
} from "../lib/database";
import { ROLLUP_FUNCTIONS, type Related } from "../lib/dbview";
import { FUNCTION_NAMES, checkFormula } from "../lib/formula";
import { KIND_ICONS } from "./kindIcons";
import { Popover, PopoverItem } from "./Popover";

interface Props {
  anchor: HTMLElement;
  /** `null` es la columna «Nombre», que no se puede cambiar. */
  column: Column | null;
  db: Database;
  related: Related;
  /** Bases de datos de la bóveda, para elegir la de una relación. */
  databases: { path: string; name: string }[];
  onClose: () => void;
  onRename: (name: string) => void;
  onChange: (column: Column) => void;
  onSort: (desc: boolean) => void;
  onFilter: () => void;
  onHide: () => void;
  onDelete: () => void;
}

const KINDS = Object.keys(KIND_LABELS) as Kind[];
const selectClass =
  "w-full rounded-md border border-neutral-200 bg-transparent px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900";
const label = "mb-1 block text-xs text-neutral-400";

/** Menú de una columna: nombre, tipo, ajustes de su tipo y acciones. */
export function ColumnMenu({
  anchor,
  column,
  db,
  related,
  databases,
  onClose,
  onRename,
  onChange,
  onSort,
  onFilter,
  onHide,
  onDelete,
}: Props) {
  const [name, setName] = useState(column?.name ?? "");
  const [formula, setFormula] = useState(column?.formula ?? "");
  const formulaError = column?.kind === "formula" && formula.trim() ? checkFormula(formula) : null;
  const act = (f: () => void) => () => {
    onClose();
    f();
  };

  const renameNow = () => {
    const n = name.trim();
    if (column && n && n !== column.name) onRename(n);
  };

  const relations = db.columns.filter((c) => c.kind === "relation");
  const rollupTarget = column?.rollup
    ? related[db.columns.find((c) => c.name === column.rollup!.relation)?.relation ?? ""]
    : undefined;

  return (
    <Popover
      anchor={anchor}
      onClose={() => {
        // Lo escrito en la fórmula no se pierde al cerrar con Escape o clic fuera.
        if (column?.kind === "formula" && formula !== (column.formula ?? "")) onChange({ ...column, formula });
        renameNow();
        onClose();
      }}
      className="w-72 p-1.5"
    >
      {column && (
        <div className="space-y-2 border-b border-neutral-200 p-1.5 pb-3 dark:border-neutral-700">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (renameNow(), onClose())}
            aria-label="Nombre de la propiedad"
            className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 outline-none focus:border-violet-400 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <label className="block">
            <span className={label}>Tipo</span>
            <select
              value={column.kind}
              onChange={(e) => onChange({ ...column, kind: e.target.value as Kind })}
              className={selectClass}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>

          {column.kind === "formula" && (
            <div>
              <span className={label}>Fórmula</span>
              <textarea
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                onBlur={() => formula !== (column.formula ?? "") && onChange({ ...column, formula })}
                rows={3}
                spellCheck={false}
                placeholder={'if(prop("hecha"), "✅", "⏳")'}
                aria-label="Fórmula"
                className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-xs outline-none focus:border-violet-400 dark:border-neutral-700 dark:bg-neutral-900"
              />
              <p className={`mt-1 text-xs ${formulaError ? "text-red-500" : "text-neutral-400"}`}>
                {formulaError ?? "Usa prop(\"nombre\") para leer otra propiedad."}
              </p>
              <details className="mt-1 text-xs text-neutral-400">
                <summary className="cursor-pointer">Funciones</summary>
                <p className="mt-1 font-mono leading-5">{FUNCTION_NAMES.join(", ")}</p>
              </details>
            </div>
          )}

          {column.kind === "relation" && (
            <label className="block">
              <span className={label}>Base de datos relacionada</span>
              <select
                value={column.relation ?? ""}
                onChange={(e) => onChange({ ...column, relation: e.target.value || undefined })}
                className={selectClass}
              >
                <option value="">Elegir…</option>
                {databases.map((d) => (
                  <option key={d.path} value={d.path}>
                    {d.path}
                  </option>
                ))}
              </select>
            </label>
          )}

          {column.kind === "rollup" && (
            <div className="space-y-2">
              <label className="block">
                <span className={label}>Relación</span>
                <select
                  value={column.rollup?.relation ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...column,
                      rollup: { relation: e.target.value, property: "", function: column.rollup?.function ?? "count" },
                    })
                  }
                  className={selectClass}
                >
                  <option value="">Elegir…</option>
                  {relations.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
                {relations.length === 0 && (
                  <span className="mt-1 block text-xs text-neutral-400">Añade antes una propiedad de tipo Relación.</span>
                )}
              </label>
              {column.rollup?.relation && (
                <>
                  <label className="block">
                    <span className={label}>Propiedad</span>
                    <select
                      value={column.rollup.property}
                      onChange={(e) => onChange({ ...column, rollup: { ...column.rollup!, property: e.target.value } })}
                      className={selectClass}
                    >
                      <option value="">Nombre</option>
                      {(rollupTarget?.columns ?? []).map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={label}>Calcular</span>
                    <select
                      value={column.rollup.function}
                      onChange={(e) => onChange({ ...column, rollup: { ...column.rollup!, function: e.target.value } })}
                      className={selectClass}
                    >
                      {Object.entries(ROLLUP_FUNCTIONS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </div>
          )}
        </div>
      )}
      <div className="pt-1">
        <PopoverItem onClick={act(() => onSort(false))}>
          <ArrowUp className="size-4 text-neutral-400" /> Orden ascendente
        </PopoverItem>
        <PopoverItem onClick={act(() => onSort(true))}>
          <ArrowDown className="size-4 text-neutral-400" /> Orden descendente
        </PopoverItem>
        <PopoverItem onClick={act(onFilter)}>
          <FilterIcon className="size-4 text-neutral-400" /> Filtrar por esta propiedad
        </PopoverItem>
        {column && (
          <>
            <PopoverItem onClick={act(onHide)}>
              <EyeOff className="size-4 text-neutral-400" /> Ocultar en esta vista
            </PopoverItem>
            <PopoverItem danger onClick={act(onDelete)}>
              <Trash2 className="size-4" /> Eliminar propiedad
            </PopoverItem>
          </>
        )}
      </div>
    </Popover>
  );
}

/** Icono del tipo de una columna (o del nombre). */
export function ColumnIcon({ kind }: { kind: Kind | null }) {
  const Icon = kind ? KIND_ICONS[kind] : KIND_ICONS.text;
  return <Icon className="size-3.5 shrink-0 text-neutral-400" />;
}
