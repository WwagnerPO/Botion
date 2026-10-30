import { useMemo } from "react";
import { COLORS, type ColorName } from "../lib/colors";
import { CHART_FUNCTIONS, chartData, type ChartPoint } from "../lib/dbview";
import { chartOf } from "./ViewControls";
import type { ViewProps } from "./viewProps";

const ORDER: ColorName[] = ["azul", "verde", "naranja", "morado", "rosa", "rojo", "amarillo", "marrón", "gris"];
const SERIES = ORDER.map((c) => COLORS[c].text);
const fmt = (n: number) => n.toLocaleString("es", { maximumFractionDigits: 2 });

/** Vista de gráfico: barras, líneas o tarta a partir de las filas filtradas. */
export function ChartView({ view, rows, ctx }: Pick<ViewProps, "view" | "rows" | "ctx">) {
  const chart = chartOf(view);
  const points = useMemo(() => chartData(rows, chart, ctx), [rows, chart, ctx]);
  const what = chart.function === "count" || !chart.y ? "Filas" : `${CHART_FUNCTIONS[chart.function]} de ${chart.y}`;

  if (points.length === 0) return <p className="mt-6 text-sm text-neutral-400">No hay datos que dibujar.</p>;
  return (
    <figure className="mt-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800" aria-label="Gráfico">
      <figcaption className="mb-3 text-xs text-neutral-400">
        {what}
        {chart.x ? ` por ${chart.x}` : ""}
      </figcaption>
      {chart.kind === "pie" ? <Pie points={points} /> : <Bars points={points} line={chart.kind === "line"} />}
    </figure>
  );
}

function Bars({ points, line }: { points: ChartPoint[]; line: boolean }) {
  const max = Math.max(...points.map((p) => p.value), 0) || 1;
  const step = 56;
  const h = 220;
  const w = Math.max(points.length * step, 320);
  const y = (v: number) => h - (Math.max(v, 0) / max) * (h - 24);
  const rotate = points.some((p) => p.label.length > 8);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w + 40} ${h + (rotate ? 70 : 30)}`} width={w + 40} className="max-w-none text-neutral-500" role="img">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={36} x2={w + 36} y1={y(max * f)} y2={y(max * f)} className="stroke-neutral-200 dark:stroke-neutral-800" />
            <text x={30} y={y(max * f) + 4} textAnchor="end" className="fill-neutral-400 text-[10px]">
              {fmt(max * f)}
            </text>
          </g>
        ))}
        {line && (
          <polyline
            fill="none"
            stroke={SERIES[0]}
            strokeWidth={2}
            points={points.map((p, i) => `${36 + i * step + step / 2},${y(p.value)}`).join(" ")}
          />
        )}
        {points.map((p, i) => {
          const cx = 36 + i * step + step / 2;
          return (
            <g key={p.label}>
              <title>{`${p.label}: ${fmt(p.value)}`}</title>
              {line ? (
                <circle cx={cx} cy={y(p.value)} r={4} fill={SERIES[0]} />
              ) : (
                <rect x={cx - 16} y={y(p.value)} width={32} height={h - y(p.value)} rx={4} fill={SERIES[i % SERIES.length]} />
              )}
              <text x={cx} y={y(p.value) - 6} textAnchor="middle" className="fill-neutral-600 text-[11px] dark:fill-neutral-300">
                {fmt(p.value)}
              </text>
              <text
                x={cx}
                y={h + 16}
                textAnchor={rotate ? "end" : "middle"}
                transform={rotate ? `rotate(-35 ${cx} ${h + 16})` : undefined}
                className="fill-neutral-500 text-[11px]"
              >
                {p.label.length > 18 ? `${p.label.slice(0, 17)}…` : p.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Pie({ points }: { points: ChartPoint[] }) {
  const total = points.reduce((a, p) => a + Math.max(p.value, 0), 0) || 1;
  let angle = -Math.PI / 2;
  const r = 90;
  const arcs = points.map((p, i) => {
    const a = (Math.max(p.value, 0) / total) * Math.PI * 2;
    const start = angle;
    angle += a;
    const large = a > Math.PI ? 1 : 0;
    const [x1, y1, x2, y2] = [Math.cos(start) * r, Math.sin(start) * r, Math.cos(angle) * r, Math.sin(angle) * r];
    const d = a >= Math.PI * 2 - 1e-9 ? `M ${-r} 0 A ${r} ${r} 0 1 1 ${r} 0 A ${r} ${r} 0 1 1 ${-r} 0` : `M 0 0 L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return { p, d, color: SERIES[i % SERIES.length] };
  });
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="-100 -100 200 200" width={200} height={200} role="img">
        {arcs.map((a) => (
          <path key={a.p.label} d={a.d} fill={a.color} className="stroke-white dark:stroke-neutral-950" strokeWidth={1.5}>
            <title>{`${a.p.label}: ${fmt(a.p.value)}`}</title>
          </path>
        ))}
      </svg>
      <ul className="space-y-1 text-sm">
        {arcs.map((a) => (
          <li key={a.p.label} className="flex items-center gap-2">
            <span className="size-3 rounded-sm" style={{ background: a.color }} />
            <span className="text-neutral-700 dark:text-neutral-200">{a.p.label}</span>
            <span className="text-neutral-400 tabular-nums">
              {fmt(a.p.value)} · {Math.round((Math.max(a.p.value, 0) / total) * 100)} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
