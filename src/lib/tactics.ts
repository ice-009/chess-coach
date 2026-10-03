import { Chess } from 'chess.js';
import type { Color, PieceSymbol, Square } from 'chess.js';

export const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const PIECE_NAME: Record<PieceSymbol, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

/** Material balance in pawns from `pov`'s side (positive = pov is ahead). */
export function materialBalance(chess: Chess, pov: Color): number {
  let sum = 0;
  for (const row of chess.board()) for (const p of row) if (p) sum += (p.color === pov ? 1 : -1) * VALUE[p.type];
  return sum;
}

/** Non-pawn material of both sides, used to tell the game phase. */
export function phaseOf(fen: string, ply: number): 'opening' | 'middlegame' | 'endgame' {
  const c = new Chess(fen);
  let pieces = 0;
  for (const row of c.board()) for (const p of row) if (p && p.type !== 'p' && p.type !== 'k') pieces += VALUE[p.type];
  if (pieces <= 26) return 'endgame'; // roughly: queens off, or few pieces left
  return ply < 20 ? 'opening' : 'middlegame';
}

/** Enemy king / pieces worth 3+ attacked by the piece on `sq`. Two or more means a fork. */
export function forkTargets(c: Chess, sq: Square, by: Color): PieceSymbol[] {
  const enemy: Color = by === 'w' ? 'b' : 'w';
  const out: PieceSymbol[] = [];
  for (const row of c.board()) {
    for (const p of row) {
      if (!p || p.color !== enemy || (p.type !== 'k' && VALUE[p.type] < 3)) continue;
      if (c.attackers(p.square, by).includes(sq)) out.push(p.type);
    }
  }
  return out.length >= 2 ? out : [];
}

export interface LineStep {
  san: string;
  from: Square;
  color: Color;
  piece: PieceSymbol;
  to: Square;
  captured?: PieceSymbol;
  check: boolean;
  fork: PieceSymbol[];
  balance: number; // material from pov's side after this ply
}

export interface PlayedLine {
  start: number; // material balance before the line
  steps: LineStep[];
  mate: boolean; // the line ends in checkmate
}

/** Plays an engine line (UCI moves) and tracks material, checks, captures and forks along the way. */
export function playLine(fen: string, uci: string[], pov: Color, maxPlies = 8): PlayedLine {
  const c = new Chess(fen);
  const start = materialBalance(c, pov);
  const steps: LineStep[] = [];
  for (const u of uci.slice(0, maxPlies)) {
    let m;
    try {
      m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    } catch {
      break;
    }
    steps.push({
      san: m.san,
      from: m.from,
      color: m.color,
      piece: m.piece,
      to: m.to,
      captured: m.captured,
      check: c.inCheck(),
      fork: forkTargets(c, m.to, m.color),
      balance: materialBalance(c, pov),
    });
  }
  return { start, steps, mate: c.isCheckmate() };
}

/**
 * Material pov ends up with along a line, measured only after pov's own moves (so a capture that
 * pov immediately takes back doesn't count as a loss). Falls back to the last ply for very short lines.
 */
export function settledBalance(line: PlayedLine, pov: Color): number {
  const own = line.steps.filter((s) => s.color === pov).map((s) => s.balance);
  if (own.length) return Math.min(...own);
  return line.steps.length ? line.steps[line.steps.length - 1].balance : line.start;
}

/** "1. Nf3 Nc6 2. Bb5"-style text for a played line, starting from the given FEN. */
export function lineText(fen: string, steps: LineStep[], max = 6): string {
  const parts = fen.split(' ');
  let no = Number(parts[5] ?? 1);
  let out = parts[1] === 'b' && steps.length ? `${no}… ` : '';
  steps.slice(0, max).forEach((s) => {
    if (s.color === 'w') out += `${no}. ${s.san} `;
    else {
      out += `${s.san} `;
      no++;
    }
  });
  return out.trim();
}
