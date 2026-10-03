import { useMemo, useState } from 'react';
import { useWidth } from '../lib/useWidth';

interface Point {
  year: number;
  elo: number;
}

const H = 200;
const PAD = { left: 44, right: 52, top: 18, bottom: 26 };

/** Peak rating by year: one series, so no legend; the title names it. Crosshair + table twin. */
export function RatingChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const { ref, width: W } = useWidth<HTMLDivElement>();

  const geo = useMemo(() => {
    const years = data.map((d) => d.year);
    const elos = data.map((d) => d.elo);
    const lo = Math.floor((Math.min(...elos) - 30) / 100) * 100;
    const hi = Math.ceil((Math.max(...elos) + 30) / 100) * 100;
    const y0 = Math.min(...years);
    const y1 = Math.max(...years);
    const x = (yr: number) => PAD.left + ((yr - y0) / Math.max(1, y1 - y0)) * (W - PAD.left - PAD.right);
    const y = (e: number) => PAD.top + (1 - (e - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
    const step = (hi - lo) / 100 > 6 ? 200 : 100;
    const ticks: number[] = [];
    for (let t = lo; t <= hi; t += step) ticks.push(t);
    const maxTicks = Math.max(3, Math.floor(W / 80)); // about one year label per 80px, so labels never collide
    const xTicks = years.length <= maxTicks ? years : years.filter((yr) => yr % Math.ceil((y1 - y0) / maxTicks) === 0);
    const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(d.year).toFixed(1)},${y(d.elo).toFixed(1)}`).join(' ');
    const peak = data.reduce((a, b) => (b.elo > a.elo ? b : a));
    return { x, y, ticks, xTicks, path, peak };
  }, [data, W]);

  if (data.length < 2) return null;
  const last = data[data.length - 1];
  const active = hover !== null ? data[hover] : null;

  function nearest(clientX: number, rect: DOMRect) {
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    data.forEach((d, i) => {
      if (Math.abs(geo.x(d.year) - px) < Math.abs(geo.x(data[best].year) - px)) best = i;
    });
    return best;
  }

  return (
    <figure className="rating-chart">
      <figcaption>Peak rating by year</figcaption>
      <div className="chart-wrap" ref={ref}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Peak rating by year, from ${data[0].elo} in ${data[0].year} to ${last.elo} in ${last.year}; highest ${geo.peak.elo} in ${geo.peak.year}.`}
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
          {geo.xTicks.map((yr) => (
            <text key={yr} x={geo.x(yr)} y={H - 6} textAnchor="middle" className="tick">{yr}</text>
          ))}
          <path d={geo.path} className="line" />
          {/* selective labels: the peak and the latest value only */}
          <text x={geo.x(geo.peak.year)} y={geo.y(geo.peak.elo) - 8} textAnchor="middle" className="label">{geo.peak.elo}</text>
          {last !== geo.peak && (
            <text x={geo.x(last.year) + 8} y={geo.y(last.elo) + 4} className="label">{last.elo}</text>
          )}
          <circle cx={geo.x(last.year)} cy={geo.y(last.elo)} r={4} className="dot" />
          {active && (
            <g>
              <line x1={geo.x(active.year)} x2={geo.x(active.year)} y1={PAD.top} y2={H - PAD.bottom} className="crosshair" />
              <circle cx={geo.x(active.year)} cy={geo.y(active.elo)} r={5} className="dot" />
            </g>
          )}
        </svg>
        {active && (
          <div className="chart-tip" style={{ left: `${(geo.x(active.year) / W) * 100}%` }}>
            <b>{active.elo}</b>
            <span>{active.year}</span>
          </div>
        )}
      </div>
      <details className="table-twin">
        <summary>Show as table</summary>
        <table>
          <thead>
            <tr><th>Year</th><th>Peak rating</th></tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.year}><td>{d.year}</td><td>{d.elo}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
