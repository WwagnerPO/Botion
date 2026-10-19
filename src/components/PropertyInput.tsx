import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink, FileText, Mail, Paperclip, Phone, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fromNote, openInSystem, pickFile, saveAttachment } from "../lib/attachments";
import { getDatabase, type Kind, type PropValue, type Row } from "../lib/database";
import { linkTarget } from "../lib/dbview";
import { Popover } from "./Popover";

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
  /** Nota de la fila: los archivos se guardan junto a ella. */
  notePath?: string;
  /** Carpeta de la base de datos de una relación. */
  relation?: string;
  /** Abrir el destino de un enlace de una relación. */
  onOpenLink?: (target: string) => void;
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

/** «2026-10-25» → «25 oct 2026» (y la hora si la tiene). */
export function formatDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(value);
  if (!m) return value;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const day = date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return m[4] ? `${day}, ${m[4]}:${m[5]}` : day;
}

/** Enlace web, de correo o de teléfono que se abre con el sistema. */
export function hrefFor(kind: Kind, value: string) {
  if (kind === "email") return `mailto:${value}`;
  if (kind === "phone") return `tel:${value.replace(/[^\d+]/g, "")}`;
  return /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
}

function openExternal(url: string) {
  openUrl(url).catch(() => window.open(url, "_blank"));
}

const fileName = (link: string) => decodeURI(link).split("/").pop() ?? link;

/**
 * Valor de una celda para leer (también el de las columnas calculadas):
 * fechas legibles, casillas, píldoras y enlaces.
 */
export function CellView({
  kind,
  value,
  error,
  notePath = "",
  onOpenLink,
  alignNumbers = true,
}: {
  kind: Kind;
  value: PropValue | undefined;
  error?: string;
  notePath?: string;
  onOpenLink?: (target: string) => void;
  alignNumbers?: boolean;
}) {
  if (error) {
    return (
      <span className="block truncate px-1.5 py-1 text-xs text-red-500" title={error}>
        ⚠ {error}
      </span>
    );
  }
  const list = asList(value);
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length))
    return <span className="block min-h-7" />;
  if (typeof value === "boolean" || kind === "checkbox") {
    return (
      <span className="block px-1.5 py-1">
        <input type="checkbox" checked={value === true} readOnly tabIndex={-1} className="size-4 accent-violet-600" />
      </span>
    );
  }
  if (kind === "tags" || kind === "select" || (kind === "rollup" && Array.isArray(value))) {
    return (
      <span className="flex flex-wrap gap-1 px-1.5 py-1">
        {list.map((t) => (
          <Pill key={t} text={t} />
        ))}
      </span>
    );
  }
  if (kind === "relation") {
    return (
      <span className="flex flex-wrap gap-1 px-1.5 py-1">
        {list.map((t) => (
          <RelationPill key={t} link={t} onOpen={onOpenLink} />
        ))}
      </span>
    );
  }
  if (kind === "files") {
    return (
      <span className="flex flex-wrap gap-1 px-1.5 py-1">
        {list.map((f) => (
          <FilePill key={f} link={f} notePath={notePath} />
        ))}
      </span>
    );
  }
  if (kind === "url" || kind === "email" || kind === "phone") {
    const t = String(value);
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openExternal(hrefFor(kind, t));
        }}
        className="block w-full truncate px-1.5 py-1 text-left text-sm text-violet-700 underline decoration-violet-300 underline-offset-2 dark:text-violet-300"
        title={t}
      >
        {t}
      </button>
    );
  }
  const t = String(value);
  const isNumber = typeof value === "number";
  return (
    <span
      className={`block truncate px-1.5 py-1 text-sm ${isNumber && alignNumbers ? "text-right tabular-nums" : ""}`}
      title={t}
    >
      {/^\d{4}-\d{2}-\d{2}/.test(t) ? formatDate(t) : isNumber ? value.toLocaleString("es-ES") : t}
    </span>
  );
}

function RelationPill({ link, onOpen }: { link: string; onOpen?: (target: string) => void }) {
  const target = linkTarget(link);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.(target);
      }}
      className="inline-flex max-w-full items-center gap-1 truncate rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-700 underline-offset-2 hover:underline dark:bg-neutral-800 dark:text-neutral-200"
    >
      <FileText className="size-3 shrink-0 text-neutral-400" />
      <span className="truncate">{target.split("/").pop()}</span>
    </button>
  );
}

function FilePill({ link, notePath, onRemove }: { link: string; notePath: string; onRemove?: () => void }) {
  return (
    <span className="group/file inline-flex max-w-full items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-xs dark:bg-neutral-800">
      <Paperclip className="size-3 shrink-0 text-neutral-400" />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openInSystem(fromNote(notePath, link)).catch(() => {});
        }}
        className="truncate hover:underline"
        title={link}
      >
        {fileName(link)}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar ${fileName(link)}`}
          className="hidden text-neutral-400 group-hover/file:inline hover:text-red-500"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

/** Lista de filas de otra base de datos para marcar las relacionadas. */
function RelationPicker({
  anchor,
  folder,
  value,
  onChange,
  onClose,
}: {
  anchor: HTMLElement;
  folder: string;
  value: string[];
  onChange: (links: string[]) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    getDatabase(folder)
      .then((db) => setRows(db.rows))
      .catch(() => setRows([]));
  }, [folder]);
  const selected = new Set(value.map((v) => linkTarget(v).toLowerCase()));
  const isOn = (r: Row) => selected.has(r.name.toLowerCase()) || selected.has(r.path.replace(/\.md$/, "").toLowerCase());
  const q = query.trim().toLowerCase();
  const shown = (rows ?? []).filter((r) => r.name.toLowerCase().includes(q));
  const toggle = (r: Row) => {
    if (isOn(r)) {
      onChange(value.filter((v) => {
        const t = linkTarget(v).toLowerCase();
        return t !== r.name.toLowerCase() && t !== r.path.replace(/\.md$/, "").toLowerCase();
      }));
    } else {
      onChange([...value, `[[${r.name}]]`]);
    }
  };
  return (
    <Popover anchor={anchor} onClose={onClose} className="w-64 p-1">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Buscar en ${folder}…`}
        className="mb-1 w-full rounded-md bg-neutral-100 px-2 py-1 outline-none dark:bg-neutral-900"
      />
      <div className="max-h-64 overflow-y-auto">
        {rows === null && <p className="px-2 py-1 text-neutral-400">Cargando…</p>}
        {rows && shown.length === 0 && <p className="px-2 py-1 text-neutral-400">Sin notas.</p>}
        {shown.map((r) => (
          <label key={r.path} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-700/70">
            <input type="checkbox" checked={isOn(r)} onChange={() => toggle(r)} className="accent-violet-600" />
            <span className="truncate">{r.name}</span>
          </label>
        ))}
      </div>
    </Popover>
  );
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
  notePath = "",
  relation,
  onOpenLink,
}: Props) {
  const anchor = useRef<HTMLDivElement>(null);
  const [picking, setPicking] = useState(false);
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

  if (kind === "relation" || kind === "files") {
    const list = asList(value);
    const add = async () => {
      if (kind === "relation") return setPicking(true);
      const file = await pickFile("");
      if (!file || !notePath) return;
      onChange([...list, await saveAttachment(notePath, file)]);
    };
    return (
      <div ref={anchor} className="group/cell flex min-h-7 flex-wrap items-center gap-1 px-1.5 py-1">
        {kind === "relation"
          ? list.map((t) => <RelationPill key={t} link={t} onOpen={onOpenLink} />)
          : list.map((f) => (
              <FilePill key={f} link={f} notePath={notePath} onRemove={() => onChange(list.filter((x) => x !== f))} />
            ))}
        <button
          type="button"
          onClick={add}
          disabled={kind === "relation" && !relation}
          title={kind === "relation" ? (relation ? `Elegir de ${relation}` : "Elige la base de datos de la relación") : "Añadir archivo"}
          aria-label={kind === "relation" ? "Elegir notas relacionadas" : "Añadir archivo"}
          className="grid size-5 place-items-center rounded text-neutral-400 opacity-0 group-hover/cell:opacity-100 focus:opacity-100 hover:bg-neutral-200 disabled:cursor-not-allowed dark:hover:bg-neutral-700"
        >
          <Plus className="size-3.5" />
        </button>
        {picking && relation && anchor.current && (
          <RelationPicker
            anchor={anchor.current}
            folder={relation}
            value={list}
            onChange={(links) => onChange(links.length ? links : null)}
            onClose={() => setPicking(false)}
          />
        )}
      </div>
    );
  }

  // Calculadas: solo se leen.
  if (kind === "formula" || kind === "rollup" || kind === "created" || kind === "edited") {
    return <CellView kind={kind} value={value} alignNumbers={alignNumbers} />;
  }

  // URL, email y teléfono: enlace que se abre, y se editan al hacer clic al lado.
  if ((kind === "url" || kind === "email" || kind === "phone") && !editing && text) {
    const Icon = kind === "email" ? Mail : kind === "phone" ? Phone : ExternalLink;
    return (
      <div className="group/cell flex min-h-7 items-center gap-1 pr-1">
        <button type="button" onClick={() => setEditing(true)} className="min-w-0 flex-1 truncate px-1.5 py-1 text-left text-sm text-violet-700 underline decoration-violet-300 underline-offset-2 dark:text-violet-300" title={text}>
          {text}
        </button>
        <button
          type="button"
          onClick={() => openExternal(hrefFor(kind, text))}
          aria-label="Abrir"
          title="Abrir"
          className="grid size-5 shrink-0 place-items-center rounded text-neutral-400 opacity-0 group-hover/cell:opacity-100 hover:bg-neutral-200 dark:hover:bg-neutral-700"
        >
          <Icon className="size-3.5" />
        </button>
      </div>
    );
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
        type={kind === "date" ? "date" : kind === "email" ? "email" : kind === "url" ? "url" : kind === "phone" ? "tel" : "text"}
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
