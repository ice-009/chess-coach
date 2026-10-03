/** Vertical evaluation bar. whitePct = White's winning chances (0–100). */
export function EvalBar({ whitePct, label, flipped }: { whitePct: number | null; label?: string; flipped: boolean }) {
  const pct = whitePct ?? 50;
  return (
    <div className={`eval-bar ${flipped ? 'flipped' : ''}`}>
      <div className="eval-fill" style={{ transform: `scaleY(${pct / 100})` }} />
      {label && whitePct !== null && <span className={`eval-num ${pct >= 50 ? 'on-white' : 'on-black'}`}>{label.replace('+', '')}</span>}
    </div>
  );
}
