import { ChevronDown, ChevronRight, ExternalLink, FileText, Highlighter, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { newBlockId } from "../lib/blockRefs";
import { highlightsMarkdown, parseHighlights, sidecarPath, type Highlight, type Rect } from "../lib/pdfHighlights";
import type { EmbedHost } from "./Embed";

type PdfDoc = import("pdfjs-dist/legacy/build/pdf.mjs").PDFDocumentProxy;

/**
 * Carga pdf.js solo cuando hace falta (es grande). Se usa la versión
 * «legacy», que trae lo que les falta a los WebView de Safari y Linux.
 */
async function loadPdfjs() {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

/** PDF incrustado en la nota: páginas, texto seleccionable y subrayados. */
export function PdfViewer({ path, host }: { path: string; host: EmbedHost }) {
  const name = path.split("/").pop()!;
  const [open, setOpen] = useState(true);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [pending, setPending] = useState<{ x: number; y: number; page: number; text: string; rects: Rect[] } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const sidecar = sidecarPath(path);

  useEffect(() => {
    if (!open || doc) return;
    let current = true;
    loadPdfjs()
      .then(async (pdfjs) => pdfjs.getDocument({ data: new Uint8Array(await host.readFile(path)) }).promise)
      .then((d) => current && setDoc(d))
      .catch((e) => current && setError(String(e?.message ?? e)));
    return () => {
      current = false;
    };
  }, [open, doc, path, host]);

  // Subrayados guardados en la nota de al lado.
  useEffect(() => {
    let current = true;
    host
      .readNote(sidecar)
      .then((md) => current && setHighlights(parseHighlights(md)))
      .catch(() => current && setHighlights([]));
    return () => {
      current = false;
    };
  }, [sidecar, host]);

  const save = useCallback(
    async (list: Highlight[]) => {
      setHighlights(list);
      let existing: string | null = null;
      try {
        existing = await host.readNote(sidecar);
      } catch {
        await host.createNote(sidecar.replace(/\.md$/, ""));
      }
      await host.writeNote(sidecar, highlightsMarkdown(existing, path, list));
    },
    [host, path, sidecar],
  );

  // Al soltar el ratón con texto seleccionado se ofrece subrayarlo.
  function onMouseUp() {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!sel || !text || sel.rangeCount === 0) return setPending(null);
    const range = sel.getRangeAt(0);
    const page = (range.startContainer.parentElement ?? null)?.closest<HTMLElement>("[data-page]");
    if (!page || !scroller.current?.contains(page)) return setPending(null);
    const box = page.getBoundingClientRect();
    const rects: Rect[] = [...range.getClientRects()]
      .filter((r) => r.width > 1 && r.height > 1)
      .map((r) => [(r.left - box.left) / box.width, (r.top - box.top) / box.height, r.width / box.width, r.height / box.height]);
    const last = range.getBoundingClientRect();
    setPending({ x: last.right, y: last.bottom, page: Number(page.dataset.page), text, rects });
  }

  return (
    <div className="pdf-viewer embed-box" contentEditable={false}>
      <div className="embed-header">
        <button type="button" className="embed-label" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          <FileText className="size-3.5" /> {name}
          {doc && <span className="embed-muted"> · {doc.numPages} págs.</span>}
          {highlights.length > 0 && <span className="embed-muted"> · {highlights.length} subrayados</span>}
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => host.openFile(path)}>
          Abrir <ExternalLink className="size-3" />
        </button>
      </div>
      {open && (
        <>
          <div
            ref={scroller}
            className="pdf-pages"
            // La incrustación se puede arrastrar; mientras se selecciona texto del
            // PDF se desactiva para que el ratón seleccione en lugar de arrastrar.
            onMouseDown={(e) => {
              const embed = e.currentTarget.closest<HTMLElement>("[draggable]");
              if (!embed) return;
              embed.draggable = false;
              window.addEventListener("mouseup", () => (embed.draggable = true), { once: true });
            }}
            onMouseUp={onMouseUp}
          >
            {error && <p className="embed-muted">No se pudo abrir el PDF: {error}</p>}
            {!doc && !error && <p className="embed-muted">Cargando PDF…</p>}
            {doc &&
              Array.from({ length: doc.numPages }, (_, i) => (
                <PdfPage
                  key={i}
                  doc={doc}
                  number={i + 1}
                  highlights={highlights.filter((h) => h.page === i + 1)}
                  onRemove={(id) => save(highlights.filter((h) => h.id !== id))}
                />
              ))}
          </div>
          {highlights.length > 0 && (
            <ul className="pdf-highlights">
              {[...highlights]
                .sort((a, b) => a.page - b.page)
                .map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() =>
                        scroller.current
                          ?.querySelector(`[data-page="${h.page}"]`)
                          ?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }
                    >
                      <span className="embed-muted">p. {h.page}</span> {h.text}
                    </button>
                    <button type="button" aria-label="Quitar subrayado" onClick={() => save(highlights.filter((x) => x.id !== h.id))}>
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </>
      )}
      {pending && (
        <button
          type="button"
          className="pdf-mark-button"
          style={{ left: pending.x, top: pending.y + 6 }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const { page, text, rects } = pending;
            setPending(null);
            window.getSelection()?.removeAllRanges();
            save([...highlights, { id: `h${newBlockId()}`, page, text, rects }]).catch(() => {});
          }}
        >
          <Highlighter className="size-3.5" /> Subrayar
        </button>
      )}
    </div>
  );
}

/** Una página: se dibuja al acercarse a la vista, con su capa de texto. */
function PdfPage({
  doc,
  number,
  highlights,
  onRemove,
}: {
  doc: PdfDoc;
  number: number;
  highlights: Highlight[];
  onRemove: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(1.294);
  const [visible, setVisible] = useState(number <= 2);

  useEffect(() => {
    const el = box.current;
    if (!el || visible) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), {
      rootMargin: "400px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const page = await doc.getPage(number);
      const el = box.current;
      if (cancelled || !el) return;
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const width = el.clientWidth || 640;
      const viewport = page.getViewport({ scale: width / base.width });
      const out = window.devicePixelRatio || 1;
      const canvas = el.querySelector("canvas")!;
      canvas.width = Math.floor(viewport.width * out);
      canvas.height = Math.floor(viewport.height * out);
      const render = page.render({
        canvas,
        viewport,
        transform: out !== 1 ? [out, 0, 0, out, 0, 0] : undefined,
      });
      task = render;
      await render.promise;
      const layer = el.querySelector<HTMLDivElement>(".textLayer")!;
      layer.replaceChildren();
      // pdf.js mide el texto con estas variables (las pone su visor completo).
      layer.style.setProperty("--scale-factor", String(viewport.scale));
      layer.style.setProperty("--total-scale-factor", String(viewport.scale));
      const text = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: layer, viewport });
      task = text;
      await text.render();
    })().catch(() => {});
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [visible, doc, number]);

  return (
    <div ref={box} className="pdf-page" data-page={number} style={{ aspectRatio: `1 / ${ratio}` }}>
      <canvas />
      <div className="textLayer" />
      {highlights.flatMap((h) =>
        h.rects.map((r, i) => (
          <span
            key={`${h.id}-${i}`}
            className="pdf-highlight"
            title={`${h.text}\n(doble clic para quitar)`}
            onDoubleClick={() => onRemove(h.id)}
            style={{ left: `${r[0] * 100}%`, top: `${r[1] * 100}%`, width: `${r[2] * 100}%`, height: `${r[3] * 100}%` }}
          />
        )),
      )}
      <span className="pdf-page-number">{number}</span>
    </div>
  );
}
