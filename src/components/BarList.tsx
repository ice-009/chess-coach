// Horizontal bars for one measure (one series → one hue, no legend; the title names it).
// Values are labeled at the bar tips, so nothing hides behind the tooltip.
interface Props {
  title: string;
  rows: { label: string; value: number; note?: string }[];
  format?: (v: number) => string;
}

export function BarList({ title, rows, format = (v) => String(v) }: Props) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure className="bar-list">
      <figcaption>{title}</figcaption>
      {rows.length === 0 && <div className="muted small">Nothing to show yet.</div>}
      {rows.map((r) => (
        <div key={r.label} className="bar-row" tabIndex={0} title={`${r.label}: ${format(r.value)}${r.note ? ` (${r.note})` : ''}`}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${(r.value / max) * 100}%` }} />
            <span className="bar-value">{format(r.value)}</span>
          </span>
        </div>
      ))}
    </figure>
  );
}
