import { useEffect, useRef, useState } from "react";

export type DialogRequest =
  | {
      kind: "prompt";
      title: string;
      label: string;
      initial?: string;
      confirm: string;
      onConfirm: (value: string) => Promise<void> | void;
    }
  | {
      kind: "confirm";
      title: string;
      message: string;
      confirm: string;
      danger?: boolean;
      onConfirm: () => Promise<void> | void;
    };

interface Props {
  request: DialogRequest;
  onClose: () => void;
}

export function Dialog({ request, onClose }: Props) {
  const [value, setValue] = useState(
    request.kind === "prompt" ? (request.initial ?? "") : "",
  );
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (request.kind === "prompt") {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      confirmRef.current?.focus();
    }
  }, [request]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (request.kind === "prompt" && !value.trim()) return;
    setBusy(true);
    try {
      if (request.kind === "prompt") await request.onConfirm(value.trim());
      else await request.onConfirm();
    } finally {
      setBusy(false);
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[20vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        <h2 id="dialog-title" className="text-base font-semibold">
          {request.title}
        </h2>
        {request.kind === "prompt" ? (
          <label className="mt-3 block text-sm text-neutral-500">
            {request.label}
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-neutral-900 outline-none focus:border-violet-500 dark:border-neutral-700 dark:text-neutral-100"
            />
          </label>
        ) : (
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            {request.message}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="submit"
            disabled={busy}
            className={`rounded-md px-3 py-1.5 font-medium text-white disabled:opacity-50 ${
              request.kind === "confirm" && request.danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-neutral-900 hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            }`}
          >
            {request.confirm}
          </button>
        </div>
      </form>
    </div>
  );
}
