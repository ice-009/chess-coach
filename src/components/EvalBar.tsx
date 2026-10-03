/** Short label that fits inside the bar: one decimal under 10 pawns, whole pawns above, mates as M3. */
function barLabel(label: string): string {
  const m = label.match(/M(\d+)/);
  if (m) return `M${m[1]}`;
  if (label === '#') return '#';
  const v = Math.abs(parseFloat(label));
  if (!Number.isFinite(v)) return label.replace(/[+-]/, '');
  return v < 10 ? v.toFixed(1) : String(Math.round(v));
}

/** Vertical evaluation bar. whitePct = White's winning chances (0–100). */
export function EvalBar({ whitePct, label, flipped }: { whitePct: number | null; label?: string; flipped: boolean }) {
  const pct = whitePct ?? 50;
  return (
    <div className={`eval-bar ${flipped ? 'flipped' : ''}`} title={label}>
      <div className="eval-fill" style={{ transform: `scaleY(${pct / 100})` }} />
      {label && whitePct !== null && <span className={`eval-num ${pct >= 50 ? 'on-white' : 'on-black'}`}>{barLabel(label)}</span>}
    </div>
  );
}
