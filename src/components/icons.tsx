import type { ReactNode } from 'react';
import type { Classification } from '../lib/analysis';
import { CLASS_META } from '../lib/classMeta';

/** Round classification badge, like the ones on a game review. */
export function ClassIcon({ c, size = 18 }: { c: Classification; size?: number }) {
  const m = CLASS_META[c];
  return (
    <span className="class-icon" style={{ background: m.color, width: size, height: size, fontSize: size * (m.symbol.length > 1 ? 0.5 : 0.62) }} title={m.label}>
      {c === 'book' ? <BookGlyph /> : c === 'excellent' ? <ThumbGlyph /> : m.symbol}
    </span>
  );
}

function BookGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="62%" height="62%" fill="white" aria-hidden>
      <path d="M2 3.2C3.6 2.4 5.8 2.4 7.4 3.4v10c-1.6-.9-3.8-.9-5.4-.1zM14 3.2c-1.6-.8-3.8-.8-5.4.2v10c1.6-.9 3.8-.9 5.4-.1z" />
    </svg>
  );
}

function ThumbGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="60%" height="60%" fill="white" aria-hidden>
      <path d="M1.5 7h2.6v7.5H1.5zM5.3 14.5V7.2L8.4 1.6c1 .1 1.7.9 1.5 2L9.4 6h4c.9 0 1.5.8 1.3 1.6l-1.2 5.6c-.2.8-.8 1.3-1.6 1.3z" />
    </svg>
  );
}

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const NavIcons: Record<string, ReactNode> = {
  home: <svg viewBox="0 0 24 24" {...P}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h5v-6h4v6h5V10" /></svg>,
  learn: <svg viewBox="0 0 24 24" {...P}><path d="M2 8l10-5 10 5-10 5z" /><path d="M6 10v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" /><path d="M22 8v6" /></svg>,
  openings: <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="6" r="3" /><path d="M9.5 9.5L8 17h8l-1.5-7.5" /><path d="M6 20h12" /><path d="M7 17h10v3H7z" /></svg>,
  masters: <svg viewBox="0 0 24 24" {...P}><path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" /><path d="M5 21h14" /></svg>,
  database: <svg viewBox="0 0 24 24" {...P}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg>,
  insights: <svg viewBox="0 0 24 24" {...P}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  account: <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" /></svg>,
  offline: <svg viewBox="0 0 24 24" {...P}><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 17v3h16v-3" /></svg>,
  practice: <svg viewBox="0 0 24 24" {...P}><path d="M6 3h12l-1 6H7z" /><path d="M9 9v4a3 3 0 0 0 6 0V9" /><path d="M12 16v3M8 21h8" /></svg>,
  games: <svg viewBox="0 0 24 24" {...P}><circle cx="11" cy="11" r="7" /><path d="M21 21l-5-5" /><path d="M8 11h6M11 8v6" /></svg>,
  explore: <svg viewBox="0 0 24 24" {...P}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></svg>,
  train: <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></svg>,
};
