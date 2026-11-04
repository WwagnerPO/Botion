import { Lock } from "lucide-react";
import { useState } from "react";

/** Nota cifrada sin abrir: pide la contraseña. */
export function LockedNote({ onUnlock }: { onUnlock: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mx-14 my-10 flex max-w-sm flex-col items-start gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!password || busy) return;
        setBusy(true);
        try {
          await onUnlock(password);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="flex items-center gap-2 font-medium text-neutral-700 dark:text-neutral-200">
        <Lock className="size-4 text-violet-500" /> Esta nota está cifrada
      </p>
      <input
        autoFocus
        type="password"
        value={password}
        onChange={(e) => (setPassword(e.target.value), setError(null))}
        placeholder="Contraseña"
        aria-label="Contraseña de la nota"
        className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/25 dark:border-neutral-700 dark:bg-neutral-900"
      />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button type="submit" disabled={busy} className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
        {busy ? "Abriendo…" : "Abrir"}
      </button>
    </form>
  );
}
