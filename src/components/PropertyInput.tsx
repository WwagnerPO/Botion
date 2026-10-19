import { useEffect, useState } from "react";
import type { Kind, PropValue } from "../lib/database";

interface Props {
  kind: Kind;
  value: PropValue | undefined;
  /** Valores ya usados en la columna, para sugerir en selección y etiquetas. */
  options?: string[];
  onChange: (value: PropValue) => void;
  /** Identificador para la lista de sugerencias. */
  id: string;
  /** Números alineados a la derecha, como en una tabla. */
  alignNumbers?: boolean;
}

const PILL_COLORS = [
  "bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100",
  "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-100",
  "bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-100",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-100",
  "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-100",
  "bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-100",
  "bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-100",
  "bg-pink-100 text-pink-800 dark:bg-pink-900/60 dark:text-pink-100",
];

/** Color estable para cada valor de selección o etiqueta. */
function pillColor(text: string) {
  let hash = 0;
  for (const ch of text.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return PILL_COLORS[Math.abs(hash) % PILL_COLORS.length];
}

export function Pill({ text }: { text: string }) {
  return (
    <span
      className={`inline-block max-w-full truncate rounded px-1.5 py-0.5 text-xs ${pillColor(text)}`}
    >
      {text}
    </span>
  );
}

function asList(value: PropValue | undefined): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value === null || value === undefined || value === "") return [];
  return [String(value)];
}

/** «2026-10-25» → «25 oct 2026». Si no es una fecha, se deja igual. */
export function formatDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const inputClass =
  "w-full rounded bg-transparent px-1.5 py-1 text-sm outline-none focus:bg-white focus:ring-1 focus:ring-violet-400 dark:focus:bg-neutral-800";

/**
 * Editor de un valor según el tipo de la columna. Guarda al salir del campo
 * o al pulsar Enter; Escape descarta el cambio.
 */
export function PropertyInput({
  kind,
  value,
  options = [],
  onChange,
  id,
  alignNumbers = true,
}: Props) {
  const text =
    kind === "tags"
      ? asList(value).join(", ")
      : value === null || value === undefined
        ? ""
        : String(value);
  const [draft, setDraft] = useState(text);
  const [editing, setEditing] = useState(false);
  useEffect(() => setDraft(text), [text]);

  function commit() {
    setEditing(false);
    if (draft === text) return;
    const raw = draft.trim();
    if (raw === "") return onChange(null);
    if (kind === "number") {
      const n = Number(raw.replace(",", "."));
      return onChange(Number.isFinite(n) ? n : raw);
    }
    if (kind === "tags") {
      return onChange(
        raw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      );
    }
    onChange(raw);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") e.currentTarget.blur();
    if (e.key === "Escape") {
      setDraft(text);
      setEditing(false);
      e.currentTarget.blur();
    }
  }

  if (kind === "checkbox") {
    return (
      <input
        type="checkbox"
        checked={value === true || value === "true"}
        onChange={(e) => onChange(e.target.checked)}
        className="m-1.5 size-4 accent-violet-600"
      />
    );
  }

  // Las fechas se muestran como texto: un campo de fecha vacío en WebKit
  // enseña la fecha de hoy y parece que tiene valor.
  if (kind === "date" && !editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="min-h-7 w-full rounded px-1.5 py-1 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        {formatDate(text)}
      </button>
    );
  }

  // Selección y etiquetas se ven como «píldoras» hasta que se editan.
  if ((kind === "select" || kind === "tags") && !editing) {
    const list = asList(value);
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex min-h-7 w-full flex-wrap items-center gap-1 rounded px-1.5 py-1 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        {list.map((t) => (
          <Pill key={t} text={t} />
        ))}
      </button>
    );
  }

  return (
    <>
      <input
        type={kind === "date" ? "date" : "text"}
        inputMode={kind === "number" ? "decimal" : undefined}
        value={draft}
        autoFocus={editing}
        list={kind === "select" || kind === "tags" ? `${id}-options` : undefined}
        placeholder={kind === "tags" ? "una, otra…" : ""}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        className={`${inputClass} ${kind === "number" && alignNumbers ? "text-right tabular-nums" : ""}`}
      />
      {(kind === "select" || kind === "tags") && (
        <datalist id={`${id}-options`}>
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
    </>
  );
}
