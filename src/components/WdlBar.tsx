// Win / draw / loss bar: a diverging part-to-whole bar (light pole = White wins, gray = draws,
// dark pole = Black wins). Steps validated against the panel surface: all >= 3:1, ΔE >= 19 apart.
const SEGMENTS = [
  { key: 'w', label: 'White wins', fill: '#f0efed', ink: '#312e2b' },
  { key: 'd', label: 'Draws', fill: '#b3b1ad', ink: '#312e2b' },
  { key: 'b', label: 'Black wins', fill: '#75716c', ink: '#ffffff' },
] as const;

interface Props {
  w: number;
  d: number;
  b: number;
  labels?: [string, string, string]; // e.g. ['Wins', 'Draws', 'Losses'] for a player's own record
}

export function WdlBar({ w, d, b, labels }: Props) {
  const total = w + d + b || 1;
  const values = { w, d, b };
  const pct = (v: number) => Math.round((v / total) * 100);
  const summary = SEGMENTS.map((s, i) => `${labels?.[i] ?? s.label} ${pct(values[s.key])}%`).join(', ');
  return (
    <div className="wdl" role="img" aria-label={summary}>
      {SEGMENTS.map((s, i) => {
        const v = values[s.key];
        if (!v) return null;
        const p = (v / total) * 100;
        return (
          <span
            key={s.key}
            className="wdl-seg"
            style={{ flexGrow: p, background: s.fill, color: s.ink }}
            tabIndex={0}
            data-tip={`${pct(v)}% · ${labels?.[i] ?? s.label} (${v.toLocaleString()})`}
          >
            {/* only label a segment when the text fits comfortably; the tooltip carries the rest */}
            {p >= 16 ? `${pct(v)}%` : ''}
          </span>
        );
      })}
    </div>
  );
}
