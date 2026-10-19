import { Network, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getGraph, type Graph } from "../lib/vault";

interface Props {
  /** Nota abierta: se resalta y se puede ver solo su entorno. */
  current: string | null;
  onOpen: (path: string) => void;
  onClose: () => void;
}

interface Sim {
  x: number;
  y: number;
  vx: number;
  vy: number;
  degree: number;
}

const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Notas a menos de `depth` enlaces de `start`. */
function neighborhood(graph: Graph, start: number, depth: number) {
  const adj = graph.nodes.map(() => [] as number[]);
  for (const [a, b] of graph.edges) {
    adj[a].push(b);
    adj[b].push(a);
  }
  const seen = new Set([start]);
  let frontier = [start];
  for (let d = 0; d < depth; d++) {
    frontier = frontier.flatMap((n) => adj[n].filter((m) => !seen.has(m) && (seen.add(m), true)));
  }
  return seen;
}

/**
 * Grafo de la bóveda: cada nota es un punto y cada enlace una línea. Se
 * puede arrastrar, hacer zoom con la rueda y pulsar una nota para abrirla.
 */
export function GraphView({ current, onOpen, onClose }: Props) {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState(false);
  const [depth, setDepth] = useState(1);
  const [query, setQuery] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hover = useRef<number | null>(null);
  const view = useRef({ x: 0, y: 0, k: 1 });

  useEffect(() => {
    getGraph().then(setGraph, (e) => setError(String(e)));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Subgrafo visible: todo, o el entorno de la nota abierta.
  const shown = useMemo(() => {
    if (!graph) return null;
    const start = current ? graph.nodes.findIndex((n) => n.path === current) : -1;
    if (!local || start < 0) return { graph, current: start };
    const keep = neighborhood(graph, start, depth);
    const map = new Map<number, number>();
    const nodes = graph.nodes.filter((_, i) => keep.has(i) && (map.set(i, map.size), true));
    const edges = graph.edges
      .filter(([a, b]) => keep.has(a) && keep.has(b))
      .map(([a, b]) => [map.get(a)!, map.get(b)!] as [number, number]);
    return { graph: { nodes, edges }, current: map.get(start)! };
  }, [graph, current, local, depth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !shown) return;
    const { graph: g, current: cur } = shown;
    const ctx = canvas.getContext("2d")!;
    const n = g.nodes.length;
    const sim: Sim[] = g.nodes.map((_, i) => {
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      const r = 40 + 8 * Math.sqrt(n) * Math.sqrt(Math.random());
      return { x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0, degree: 0 };
    });
    for (const [a, b] of g.edges) {
      sim[a].degree++;
      sim[b].degree++;
    }
    const neighbors = g.nodes.map(() => new Set<number>());
    for (const [a, b] of g.edges) {
      neighbors[a].add(b);
      neighbors[b].add(a);
    }
    const q = fold(query.trim());
    const matches = (i: number) => !q || fold(g.nodes[i].name).includes(q);
    const radius = (i: number) => 3 + Math.min(9, Math.sqrt(sim[i].degree) * 2);

    let alpha = 1;
    let dragging: { node: number | null; x: number; y: number } | null = null;
    let frame = 0;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
    };
    resize();
    view.current = { x: 0, y: 0, k: n > 200 ? 0.6 : 1 };

    function tick() {
      // Repulsión entre notas, muelles en los enlaces y un poco de gravedad.
      const k = 30;
      for (let i = 0; i < n; i++) {
        const a = sim[i];
        for (let j = i + 1; j < n; j++) {
          const b = sim[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 0.01) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            d2 = 0.25;
          }
          if (d2 > 250000) continue;
          const f = (k * k) / d2;
          a.vx += dx * f * 0.02;
          a.vy += dy * f * 0.02;
          b.vx -= dx * f * 0.02;
          b.vy -= dy * f * 0.02;
        }
      }
      for (const [i, j] of g.edges) {
        const a = sim[i];
        const b = sim[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - 60) * 0.02;
        a.vx += (dx / d) * f;
        a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f;
        b.vy -= (dy / d) * f;
      }
      for (let i = 0; i < n; i++) {
        const p = sim[i];
        if (dragging?.node === i) continue;
        p.vx -= p.x * 0.004;
        p.vy -= p.y * 0.004;
        p.x += p.vx * alpha;
        p.y += p.vy * alpha;
        p.vx *= 0.6;
        p.vy *= 0.6;
      }
      alpha = Math.max(0.02, alpha * 0.985);
    }

    function draw() {
      const dark = document.documentElement.classList.contains("dark");
      const w = canvas!.width;
      const h = canvas!.height;
      const { x: ox, y: oy, k } = view.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.setTransform(dpr * k, 0, 0, dpr * k, w / 2 + ox * dpr, h / 2 + oy * dpr);
      const hv = hover.current;
      const lit = (i: number) => hv === null || i === hv || neighbors[hv].has(i);

      ctx.lineWidth = 1 / k;
      for (const [a, b] of g.edges) {
        const on = hv !== null && (a === hv || b === hv);
        ctx.strokeStyle = on ? "rgba(139,92,246,0.8)" : dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
        ctx.beginPath();
        ctx.moveTo(sim[a].x, sim[a].y);
        ctx.lineTo(sim[b].x, sim[b].y);
        ctx.stroke();
      }
      for (let i = 0; i < n; i++) {
        const p = sim[i];
        const isCur = i === cur;
        ctx.globalAlpha = lit(i) && matches(i) ? 1 : 0.2;
        ctx.fillStyle = isCur ? "#8b5cf6" : i === hv ? "#a78bfa" : dark ? "#a19e97" : "#7a7771";
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius(i), 0, Math.PI * 2);
        ctx.fill();
        if (k > 0.75 || isCur || (hv !== null && lit(i)) || (q && matches(i))) {
          ctx.fillStyle = dark ? "#e5e3df" : "#2c2b29";
          ctx.font = `${(isCur || i === hv ? 600 : 400)} ${12 / k}px Inter Variable, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(g.nodes[i].name, p.x, p.y + radius(i) + 12 / k);
        }
      }
      ctx.globalAlpha = 1;
    }

    // Al principio, el zoom se ajusta para que se vea todo el grafo.
    let fitting = 90;
    let touched = false;
    function fit() {
      if (n === 0) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of sim) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
      const r = canvas!.getBoundingClientRect();
      const k = Math.max(0.2, Math.min(2.5, 0.8 * Math.min(r.width / (maxX - minX + 80), r.height / (maxY - minY + 80))));
      const v = view.current;
      const target = { k, x: (-(minX + maxX) / 2) * k, y: (-(minY + maxY) / 2) * k };
      v.k += (target.k - v.k) * 0.15;
      v.x += (target.x - v.x) * 0.15;
      v.y += (target.y - v.y) * 0.15;
    }

    function loop() {
      if (alpha > 0.021 || dragging) tick();
      if (fitting > 0 && !touched) {
        fit();
        fitting--;
      }
      draw();
      frame = requestAnimationFrame(loop);
    }
    loop();

    const toWorld = (e: PointerEvent | WheelEvent | MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const { x, y, k } = view.current;
      return { x: (e.clientX - r.left - r.width / 2 - x) / k, y: (e.clientY - r.top - r.height / 2 - y) / k };
    };
    const nodeAt = (e: PointerEvent | MouseEvent) => {
      const p = toWorld(e);
      let best: number | null = null;
      let bestD = Infinity;
      for (let i = 0; i < n; i++) {
        const d = Math.hypot(sim[i].x - p.x, sim[i].y - p.y);
        if (d < radius(i) + 4 / view.current.k && d < bestD) {
          best = i;
          bestD = d;
        }
      }
      return best;
    };

    let moved = false;
    const down = (e: PointerEvent) => {
      touched = true;
      canvas.setPointerCapture(e.pointerId);
      moved = false;
      dragging = { node: nodeAt(e), x: e.clientX, y: e.clientY };
      alpha = Math.max(alpha, 0.3);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) {
        hover.current = nodeAt(e);
        canvas.style.cursor = hover.current === null ? "grab" : "pointer";
        return;
      }
      if (Math.hypot(e.clientX - dragging.x, e.clientY - dragging.y) > 3) moved = true;
      if (dragging.node !== null) {
        const p = toWorld(e);
        sim[dragging.node].x = p.x;
        sim[dragging.node].y = p.y;
      } else {
        view.current.x += e.clientX - dragging.x;
        view.current.y += e.clientY - dragging.y;
        dragging.x = e.clientX;
        dragging.y = e.clientY;
      }
    };
    const up = () => {
      const d = dragging;
      dragging = null;
      if (d && d.node !== null && !moved) onOpen(g.nodes[d.node].path);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      touched = true;
      const v = view.current;
      const k = Math.max(0.2, Math.min(4, v.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
      // Zoom hacia el puntero.
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left - r.width / 2;
      const my = e.clientY - r.top - r.height / 2;
      v.x = mx - ((mx - v.x) * k) / v.k;
      v.y = my - ((my - v.y) * k) / v.k;
      v.k = k;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("wheel", wheel);
      window.removeEventListener("resize", resize);
    };
  }, [shown, query, onOpen]);

  return (
    <div role="dialog" aria-label="Grafo de notas" className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-neutral-950">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-neutral-200 px-4 text-sm dark:border-neutral-800">
        <Network className="size-4 text-violet-500" />
        <span className="font-semibold">Grafo</span>
        <span className="text-xs text-neutral-400">
          {shown ? `${shown.graph.nodes.length} notas · ${shown.graph.edges.length} enlaces` : "Cargando…"}
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Resaltar…"
          aria-label="Resaltar notas"
          className="ml-4 w-48 rounded-md border border-neutral-200 bg-transparent px-2 py-1 outline-none focus:border-violet-400 dark:border-neutral-700"
        />
        {current && (
          <label className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
            <input type="checkbox" checked={local} onChange={(e) => setLocal(e.target.checked)} className="accent-violet-600" />
            Solo alrededor de la nota abierta
          </label>
        )}
        {local && (
          <select value={depth} onChange={(e) => setDepth(Number(e.target.value))} aria-label="Distancia" className="rounded-md border border-neutral-200 bg-transparent px-1 py-0.5 dark:border-neutral-700 dark:bg-neutral-900">
            <option value={1}>1 salto</option>
            <option value={2}>2 saltos</option>
            <option value={3}>3 saltos</option>
          </select>
        )}
        <button type="button" onClick={onClose} aria-label="Cerrar grafo" className="ml-auto grid size-7 place-items-center rounded-md text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <X className="size-4" />
        </button>
      </div>
      {error ? (
        <p className="p-6 text-sm text-red-500">{error}</p>
      ) : (
        <canvas ref={canvasRef} className="min-h-0 w-full flex-1 touch-none" />
      )}
      <p className="pointer-events-none absolute bottom-3 left-4 text-xs text-neutral-400">
        Arrastra para mover · rueda para acercar · clic en una nota para abrirla
      </p>
    </div>
  );
}
