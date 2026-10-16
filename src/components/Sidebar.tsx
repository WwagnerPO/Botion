export function Sidebar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
      <header className="px-4 py-3 text-sm font-semibold">Botion</header>
      <nav className="flex-1 overflow-y-auto px-2 text-sm text-neutral-500">
        <p className="px-2 py-1">Aún no hay ninguna bóveda abierta.</p>
      </nav>
    </aside>
  );
}
