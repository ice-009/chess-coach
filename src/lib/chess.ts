import { Chess } from 'chess.js';
import type { Square } from 'chess.js';

export interface MoveNode {
  san: string;
  uci: string;
  from: Square;
  to: Square;
  fenBefore: string;
  fenAfter: string;
  captured?: boolean;
  comment?: string;
}

/** Parses "e4 {comment} e5 Nf3 ..." (no move numbers needed) from a start FEN. Throws on illegal moves. */
export function parseLine(text: string, startFen?: string): MoveNode[] {
  const chess = startFen ? new Chess(startFen) : new Chess();
  const out: MoveNode[] = [];
  const tokens = text.match(/\{[^}]*\}|[^\s{}]+/g) ?? [];
  for (const tok of tokens) {
    if (tok.startsWith('{')) {
      if (out.length) out[out.length - 1].comment = tok.slice(1, -1).trim();
      continue;
    }
    if (/^\d+\.+$/.test(tok)) continue;
    const san = tok.replace(/^\d+\.+/, '');
    const fenBefore = chess.fen();
    const m = chess.move(san);
    out.push({ san: m.san, uci: m.from + m.to + (m.promotion ?? ''), from: m.from, to: m.to, fenBefore, fenAfter: chess.fen(), captured: !!m.captured });
  }
  return out;
}

export function uciToSan(fen: string, uci: string): string {
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return uci;
  }
}

/** Converts a UCI principal variation into numbered SAN, e.g. "12. Nf3 Nc6 13. Bb5" */
export function pvToSan(fen: string, pv: string[], max = 8): string {
  const c = new Chess(fen);
  let moveNo = Number(fen.split(' ')[5] ?? 1);
  let out = c.turn() === 'b' ? `${moveNo}… ` : '';
  for (const uci of pv.slice(0, max)) {
    try {
      const white = c.turn() === 'w';
      const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      out += white ? `${moveNo}. ${m.san} ` : `${m.san} `;
      if (!white) moveNo++;
    } catch {
      break;
    }
  }
  return out.trim();
}

/**
 * chess.js accepts positions where the side NOT to move is in check (its king could be captured).
 * Those can't occur in a game, and Stockfish crashes on them, so they are rejected here.
 */
export function isLegalPosition(fen: string): boolean {
  try {
    const parts = new Chess(fen).fen().split(' ');
    const flipped = [parts[0], parts[1] === 'w' ? 'b' : 'w', parts[2], '-', parts[4], parts[5]].join(' ');
    return !new Chess(flipped).inCheck();
  } catch {
    return false;
  }
}

export function sideToMove(fen: string): 'w' | 'b' {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}

export function formatScore(cp: number | null, mate: number | null): string {
  if (mate !== null) return mate === 0 ? '#' : `${mate > 0 ? '+' : '-'}M${Math.abs(mate)}`;
  const v = (cp ?? 0) / 100;
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
}

const START_COUNT: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

/**
 * What each side has captured (the opponent's missing pieces, most valuable first) and the material balance
 * from White's side. Promotions are counted the way chess.com shows them: an extra queen offsets a missing pawn.
 */
export function material(fen: string): { captured: Record<'w' | 'b', string[]>; diff: number } {
  const count: Record<'w' | 'b', Record<string, number>> = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (const ch of fen.split(' ')[0]) {
    const t = ch.toLowerCase();
    if (t in START_COUNT) count[ch === t ? 'b' : 'w'][t]++;
  }
  const captured: Record<'w' | 'b', string[]> = { w: [], b: [] };
  let score = { w: 0, b: 0 };
  for (const side of ['w', 'b'] as const) {
    const have = { ...count[side] };
    // a promoted piece stands in for one of the missing pawns
    for (const t of ['q', 'r', 'b', 'n']) {
      const extra = Math.max(0, have[t] - START_COUNT[t]);
      have[t] -= extra;
      have.p += extra;
    }
    const other = side === 'w' ? 'b' : 'w';
    for (const t of ['q', 'r', 'b', 'n', 'p']) for (let i = have[t]; i < START_COUNT[t]; i++) captured[other].push(t);
    score = { ...score, [side]: Object.entries(count[side]).reduce((a, [t, n]) => a + PIECE_VALUE[t] * n, 0) };
  }
  return { captured, diff: score.w - score.b };
}
