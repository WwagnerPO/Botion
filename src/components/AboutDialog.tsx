import { getTauriVersion, getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { BookOpen, Bug, Check, ClipboardCopy, Coffee, Globe, HelpCircle, RefreshCw, Scale } from "lucide-react";
import { useEffect, useState } from "react";
import logo from "../assets/logo.png";

export const REPO_URL = "https://github.com/WwagnerPO/Botion";
const AUTHOR = { name: "WwagnerPO", url: "https://github.com/WwagnerPO" };
export const DONATE_URL = "https://buymeacoffee.com/wwagnerpo";

/** Librerías principales con las que está hecho Botion. */
const CREDITS = [
  { name: "Tauri", url: "https://tauri.app" },
  { name: "React", url: "https://react.dev" },
  { name: "Milkdown", url: "https://milkdown.dev" },
  { name: "CodeMirror", url: "https://codemirror.net" },
  { name: "Mermaid", url: "https://mermaid.js.org" },
  { name: "PDF.js", url: "https://mozilla.github.io/pdf.js" },
  { name: "Tailwind CSS", url: "https://tailwindcss.com" },
  { name: "Lucide", url: "https://lucide.dev" },
  { name: "Inter", url: "https://rsms.me/inter" },
];

interface Props {
  onClose: () => void;
  onCheckUpdate: () => void;
}

const open = (url: string) => openUrl(url).catch(() => window.open(url, "_blank"));

/** Texto para pegar al avisar de un fallo: versión, sistema y motor. */
export function supportReport(version: string | null, system: string | null, tauri: string | null) {
  return [
    `Botion ${version ?? "desarrollo"}`,
    `Sistema: ${system ?? navigator.platform}`,
    `Tauri: ${tauri ?? "—"}`,
    `Navegador interno: ${navigator.userAgent}`,
    `Idioma: ${navigator.language}`,
  ].join("\n");
}

const row = "flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700";

/** Ventana «Acerca de Botion»: versión, autor, enlaces, soporte, créditos y licencia. */
export function AboutDialog({ onClose, onCheckUpdate }: Props) {
  const [version, setVersion] = useState<string | null>(null);
  const [system, setSystem] = useState<string | null>(null);
  const [tauri, setTauri] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [credits, setCredits] = useState(false);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion(null));
    getTauriVersion().then(setTauri).catch(() => setTauri(null));
    invoke<string>("system_info").then(setSystem).catch(() => setSystem(null));
  }, []);

  async function copyReport() {
    await navigator.clipboard.writeText(supportReport(version, system, tauri));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const links = [
    { label: "Página del proyecto", Icon: Globe, url: REPO_URL },
    { label: "Ayuda (guía de uso)", Icon: HelpCircle, url: `${REPO_URL}#índice` },
    { label: "Novedades de cada versión", Icon: BookOpen, url: `${REPO_URL}/releases` },
    { label: "Avisar de un fallo o pedir una idea", Icon: Bug, url: `${REPO_URL}/issues` },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-900/25 py-[10vh] backdrop-blur-[1px] dark:bg-black/50"
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
        <p className="mt-2 text-sm text-neutral-500">
          Hecho por{" "}
          <button type="button" onClick={() => open(AUTHOR.url)} className="font-medium text-violet-600 hover:underline dark:text-violet-400">
            {AUTHOR.name}
          </button>
        </p>

        <div className="mt-4 space-y-1 text-left text-sm">
          {links.map(({ label, Icon, url }) => (
            <button key={url} type="button" onClick={() => open(url)} className={row}>
              <Icon className="size-4 text-neutral-500" />
              {label}
            </button>
          ))}
          <button type="button" onClick={copyReport} className={row}>
            {copied ? <Check className="size-4 text-green-600" /> : <ClipboardCopy className="size-4 text-neutral-500" />}
            {copied ? "Copiado: pégalo al avisar del fallo" : "Copiar información para soporte"}
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onCheckUpdate();
            }}
            className={row}
          >
            <RefreshCw className="size-4 text-neutral-500" />
            Buscar actualizaciones
          </button>
        </div>

        <button
          type="button"
          onClick={() => open(DONATE_URL)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#FFDD00] px-4 py-1.5 text-sm font-medium text-neutral-900 shadow-sm hover:brightness-95"
        >
          <Coffee className="size-4" />
          Invítame a un café
        </button>

        <div className="mt-4 text-xs text-neutral-500">
          <button type="button" onClick={() => setCredits((c) => !c)} aria-expanded={credits} className="hover:underline">
            {credits ? "Ocultar créditos" : "Créditos"}
          </button>
          {credits && (
            <p className="mt-1.5 leading-relaxed">
              Hecho con{" "}
              {CREDITS.map((c, i) => (
                <span key={c.name}>
                  <button type="button" onClick={() => open(c.url)} className="text-violet-600 hover:underline dark:text-violet-400">
                    {c.name}
                  </button>
                  {i < CREDITS.length - 2 ? ", " : i === CREDITS.length - 2 ? " y " : "."}
                </span>
              ))}
            </p>
          )}
        </div>

        <p className="mt-3 flex items-center justify-center gap-1 text-xs text-neutral-500">
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
