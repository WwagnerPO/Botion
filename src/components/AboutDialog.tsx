import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { BookOpen, Bug, Globe, RefreshCw, Scale } from "lucide-react";
import { useEffect, useState } from "react";
import logo from "../assets/logo.png";

export const REPO_URL = "https://github.com/WwagnerPO/Botion";

interface Props {
  onClose: () => void;
  onCheckUpdate: () => void;
}

const open = (url: string) => openUrl(url).catch(() => window.open(url, "_blank"));

/** Ventana «Acerca de Botion»: versión, enlaces y licencia. */
export function AboutDialog({ onClose, onCheckUpdate }: Props) {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion(null));
  }, []);

  const links = [
    { label: "Página del proyecto", Icon: Globe, url: REPO_URL },
    { label: "Novedades de cada versión", Icon: BookOpen, url: `${REPO_URL}/releases` },
    { label: "Avisar de un fallo o pedir una idea", Icon: Bug, url: `${REPO_URL}/issues` },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-900/25 pt-[15vh] backdrop-blur-[1px] dark:bg-black/50"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        tabIndex={-1}
        ref={(el) => el?.focus()}
        className="w-full max-w-sm animate-pop rounded-xl bg-white p-6 text-center shadow-pop outline-none dark:bg-neutral-800"
      >
        <img src={logo} alt="" className="mx-auto size-16 rounded-2xl" />
        <h2 id="about-title" className="mt-3 text-lg font-semibold">
          Botion
        </h2>
        <p className="text-sm text-neutral-500">{version ? `Versión ${version}` : "Versión de desarrollo"}</p>
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
          Notas como en Notion, guardadas como archivos Markdown en tu ordenador. Compatible con Obsidian.
        </p>

        <div className="mt-4 space-y-1 text-left text-sm">
          {links.map(({ label, Icon, url }) => (
            <button
              key={url}
              type="button"
              onClick={() => open(url)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700"
            >
              <Icon className="size-4 text-neutral-500" />
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              onClose();
              onCheckUpdate();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            <RefreshCw className="size-4 text-neutral-500" />
            Buscar actualizaciones
          </button>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1 text-xs text-neutral-500">
          <Scale className="size-3.5" />
          Software libre · licencia MIT o Apache 2.0
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
