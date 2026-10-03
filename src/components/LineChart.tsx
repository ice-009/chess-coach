import { useMemo, useState } from 'react';
import { useWidth } from '../lib/useWidth';

interface Point {
  x: number; // timestamp (ms)
  y: number;
}

const H = 190;
const PAD = { left: 46, right: 52, top: 18, bottom: 26 };
const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** One series over time: 2px line, hairline grid, crosshair tooltip (hover or ←/→), labels on the extreme and the end, table twin. */
export function LineChart({
  title,
  data,
  unit = '',
  decimals = 0,
  xFormat = fmtDate,
}: {
  title: string;
  data: Point[];
  unit?: string;
  decimals?: number;
  xFormat?: (x: number) => string; // dates by default; e.g. game numbers for "per game" charts
}) {
  const [hover, setHover] = useState<number | null>(null);
  const { ref, width: W } = useWidth<HTMLDivElement>();
  const fmt = (v: number) => `${v.toFixed(decimals)}${unit}`;

  const geo = useMemo(() => {
    const ys = data.map((d) => d.y);
    const span = Math.max(...ys) - Math.min(...ys) || 10;
    const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find((s) => span / s <= 5) ?? 1000;
    const lo = Math.floor((Math.min(...ys) - span * 0.08) / step) * step;
    const hi = Math.ceil((Math.max(...ys) + span * 0.08) / step) * step;
    const x0 = data[0]?.x ?? 0;
    const x1 = data[data.length - 1]?.x ?? 1;
    const x = (t: number) => PAD.left + ((t - x0) / Math.max(1, x1 - x0)) * (W - PAD.left - PAD.right);
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.top - PAD.bottom);
    const ticks: number[] = [];
    for (let t = lo; t <= hi + 1e-9; t += step) ticks.push(t);
    const mid = data[Math.floor(data.length / 2)].x;
    const xTicks = [...new Set([x0, mid, x1])];
    const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(d.x).toFixed(1)},${y(d.y).toFixed(1)}`).join(' ');
    const extreme = data.reduce((a, b) => (b.y > a.y ? b : a), data[0]);
    return { x, y, ticks, xTicks, path, extreme };
  }, [data, W]);

  if (data.length < 2) return null;
  const last = data[data.length - 1];
  const active = hover !== null ? data[hover] : null;
  const nearest = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    data.forEach((d, i) => {
      if (Math.abs(geo.x(d.x) - px) < Math.abs(geo.x(data[best].x) - px)) best = i;
    });
    return best;
  };

  return (
    <figure className="rating-chart">
      <figcaption>{title}</figcaption>
      <div className="chart-wrap" ref={ref}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${title}: from ${fmt(data[0].y)} to ${fmt(last.y)}; highest ${fmt(geo.extreme.y)}.`}
          tabIndex={0}
          onPointerMove={(e) => setHover(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover(data.length - 1)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? data.length - 1) - 1));
            if (e.key === 'ArrowRight') setHover((h) => Math.min(data.length - 1, (h ?? 0) + 1));
          }}
        >
          {geo.ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={geo.y(t)} y2={geo.y(t)} className="grid" />
              <text x={PAD.left - 8} y={geo.y(t) + 4} textAnchor="end" className="tick">{t}</text>
            </g>
          ))}
          {geo.xTicks.map((t, i) => (
            <text key={i} x={geo.x(t)} y={H - 6} textAnchor={i === 0 ? 'start' : i === geo.xTicks.length - 1 ? 'end' : 'middle'} className="tick">{xFormat(t)}</text>
          ))}
          <path d={geo.path} className="line" />
          <text x={geo.x(geo.extreme.x)} y={geo.y(geo.extreme.y) - 8} textAnchor="middle" className="label">{fmt(geo.extreme.y)}</text>
          {last !== geo.extreme && <text x={geo.x(last.x) + 8} y={geo.y(last.y) + 4} className="label">{fmt(last.y)}</text>}
          <circle cx={geo.x(last.x)} cy={geo.y(last.y)} r={4} className="dot" />
          {active && (
            <g>
              <line x1={geo.x(active.x)} x2={geo.x(active.x)} y1={PAD.top} y2={H - PAD.bottom} className="crosshair" />
              <circle cx={geo.x(active.x)} cy={geo.y(active.y)} r={5} className="dot" />
            </g>
          )}
        </svg>
        {active && (
          <div className="chart-tip" style={{ left: `${(geo.x(active.x) / W) * 100}%` }}>
            <b>{fmt(active.y)}</b>
            <span>{xFormat(active.x)}</span>
          </div>
        )}
      </div>
      <details className="table-twin">
        <summary>Show as table</summary>
        <table>
          <tbody>
            {data.map((d, i) => (
              <tr key={i}><td>{xFormat(d.x)}</td><td>{fmt(d.y)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
