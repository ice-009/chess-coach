// "Is it safe?": you see a move you're about to play and decide whether it's safe before you play it, the
// blunder check that decides most games below 1200. This file judges a move from two engine evaluations and
// explains the verdict in plain words. Self-contained (chess.js) so it can be tested outside the browser.
import { Chess } from 'chess.js';
import type { Move, Square } from 'chess.js';
import { NAME, materialSwing } from './keyMoments.ts';

export interface Score {
  cp: number | null; // from the side to move's point of view
  mate: number | null;
}
export type Verdict = 'safe' | 'unsafe' | 'unclear';

const winPct = (cp: number) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
const cpOf = (s: Score) => (s.mate !== null ? (s.mate > 0 ? 10000 : -10000) : (s.cp ?? 0));

function play(fen: string, uci: string): { after: string; move: Move } | null {
  try {
    const c = new Chess(fen);
    const move = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return { after: c.fen(), move };
  } catch {
    return null;
  }
}

/**
 * Safe or not, from the engine's score of the position before (`best`, the mover's view) and after the move
 * (`after`, the opponent's view). Unsafe: it throws away at least 15% of your winning chances; safe: at most
 * 5%. Anything in between is unclear and isn't asked.
 */
export function verdictOf(best: Score, after: Score): { verdict: Verdict; loss: number } {
  const before = winPct(cpOf(best));
  const now = 100 - winPct(cpOf(after));
  const loss = Math.max(0, before - now);
  return { verdict: loss >= 15 ? 'unsafe' : loss <= 5 ? 'safe' : 'unclear', loss: Math.round(loss) };
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** Why a move is unsafe: the opponent's best answer (`reply`, with the engine's line after it). */
export function explainUnsafe(fen: string, uci: string, reply: string | null, pv: string[] = [], mate: number | null = null): string {
  const p = play(fen, uci);
  if (!p) return '';
  const me = p.move.color;
  const r = reply ? play(p.after, reply) : null;
  if (!r) return `${p.move.san} loses material.`;
  if (mate !== null && mate > 0) return mate === 1 ? `${r.move.san} is checkmate!` : `It allows a forced checkmate, starting with ${r.move.san}.`;
  const check = r.move.san.includes('+') ? ' (check!)' : '';
  if (r.move.captured) {
    if (r.move.to === p.move.to) return `Your ${NAME[p.move.promotion ?? p.move.piece]} can be taken on ${p.move.to}: ${r.move.san}${check}.`;
    const lostAfter = materialSwing(p.after, [reply!, ...pv], me, 6);
    if (r.move.captured === 'p' && lostAfter >= 3) return `${r.move.san}${check} starts a sequence that wins about ${lostAfter} pawns of material.`;
    return `${r.move.san}${check} takes your ${NAME[r.move.captured]} on ${r.move.to}. Your move left it undefended.`;
  }
  const swing = materialSwing(p.after, [reply!, ...pv], me, 6);
  if (swing >= 2) return `${r.move.san}${check} wins material: about ${swing} pawn${swing === 1 ? '' : 's'}. Look for double attacks and checks before you move.`;
  return `${r.move.san}${check} gives your opponent a winning position.`;
}

/** Why a move is safe, in the terms a blunder check uses: attacked? defended? anything left behind? */
export function explainSafe(fen: string, uci: string): string {
  const p = play(fen, uci);
  if (!p) return '';
  const me = p.move.color;
  const opp = me === 'w' ? 'b' : 'w';
  const piece = NAME[p.move.promotion ?? p.move.piece];
  const after = new Chess(p.after);
  const attackers = after.attackers(p.move.to as Square, opp);
  const defenders = after.attackers(p.move.to as Square, me).map((sq) => `${NAME[after.get(sq)!.type]} on ${sq}`);
  const won = p.move.captured ? `You win the ${NAME[p.move.captured]}, and ` : '';
  if (attackers.length && defenders.length)
    return `${won}${won ? 'your' : 'Your'} ${piece} on ${p.move.to} is attacked, but it’s defended by your ${list(defenders)}: taking it would cost your opponent more.`;
  if (attackers.length) return `${won}${won ? 'the' : 'The'} ${piece} on ${p.move.to} can be taken, but you get more back. Count the trades before you decide.`;
  return `${won}${won ? 'nothing' : 'Nothing'} attacks your ${piece} on ${p.move.to}, and the move doesn’t leave anything else undefended.`;
}

/**
 * Moves worth asking about in a position: the tempting ones (captures, checks, moves onto attacked squares),
 * in random order. `first` (e.g. the move a player really blundered with) comes first.
 */
export function temptingMoves(fen: string, first?: string): string[] {
  const c = new Chess(fen);
  const opp = c.turn() === 'w' ? 'b' : 'w';
  const scored = c.moves({ verbose: true }).map((m) => {
    const uci = m.from + m.to + (m.promotion ?? '');
    const reasons = (m.captured ? 3 : 0) + (m.san.includes('+') ? 2 : 0) + (c.isAttacked(m.to as Square, opp) ? 2 : 0);
    return { uci, reasons, score: reasons + Math.random() * 2 }; // a little randomness in the order only
  });
  const ordered = scored.filter((x) => x.reasons > 0).sort((a, b) => b.score - a.score).map((x) => x.uci);
  return first ? [first, ...ordered.filter((u) => u !== first)] : ordered;
}

export const sanOf = (fen: string, uci: string) => play(fen, uci)?.move.san ?? uci;
export const afterMove = (fen: string, uci: string) => play(fen, uci)?.after ?? fen;
