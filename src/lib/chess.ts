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
