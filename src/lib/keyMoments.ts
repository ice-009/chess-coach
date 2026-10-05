// Quick Review: the two or three moments that decided a game, explained in plain words, each with a habit to
// take away. Built only from the engine's evaluations (no extra analysis), so it is instant once a game has
// been reviewed. Self-contained (chess.js + types) so it can be tested outside the browser.
import { Chess } from 'chess.js';
import type { Move, Square } from 'chess.js';
import type { GameAnalysis, ParsedGame, PositionEval } from './analysis';

export type MomentKind = 'mistake' | 'missed-win';
export type MistakeType = 'allowed-mate' | 'missed-mate' | 'moved-piece-lost' | 'missed-threat' | 'piece-left' | 'missed-material' | 'other';

export interface KeyMoment {
  ply: number; // index into parsed.moves: the move made from parsed.fens[ply]
  kind: MomentKind;
  title: string;
  type: MistakeType;
  played: { san: string; uci: string };
  best: { san: string; uci: string } | null; // the engine's move in the position before
  reply: { san: string; uci: string } | null; // the opponent's best answer to the move played
  explain: string;
  rule: string;
  winBefore: number; // the player's winning chances, 0–100
  winAfter: number;
  spent: number | null; // seconds on the move
}

/** The habit each kind of mistake calls for (also shown on the dashboard for the most common one). */
export const RULES: Record<MistakeType, string> = {
  'allowed-mate': 'Before every move, look at every check your opponent could give. A check you can’t answer is mate.',
  'missed-mate': 'When you’re attacking, look at every check first: one of them may be mate.',
  'moved-piece-lost': 'Before you let go of a piece, ask: can it be taken on its new square, and who defends it there?',
  'missed-threat': 'After every opponent move, ask: what does it attack? Deal with the threat before your own plan.',
  'piece-left': 'When a piece moves away, check what it was defending. Count attackers and defenders on your pieces.',
  'missed-material': 'Look at every capture before you move: free material wins games at every level.',
  other: 'Pick two candidate moves and compare them before you play, and use your clock for it.',
};

export const TYPE_LABEL: Record<MistakeType, string> = {
  'allowed-mate': 'Allowed checkmate',
  'missed-mate': 'Missed checkmate',
  'moved-piece-lost': 'Moved a piece where it could be taken',
  'missed-threat': 'Missed the opponent’s threat',
  'piece-left': 'Left a piece undefended',
  'missed-material': 'Missed a free capture',
  other: 'A better plan existed',
};

export const NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const winPct = (cp: number) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
/** Winning chances for `side` in a position (evaluations are from White's side; mate is ±10000). */
const winFor = (e: PositionEval, side: 'w' | 'b') => (side === 'w' ? winPct(e.cp) : 100 - winPct(e.cp));
/** Mate in favour of `side` (moves), or null. */
const mateFor = (e: PositionEval, side: 'w' | 'b') => (e.mate !== null && e.mate !== 0 && (e.mate > 0) === (side === 'w') ? Math.abs(e.mate) : null);

function move(fen: string, uci: string | null | undefined): Move | null {
  if (!uci) return null;
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return null;
  }
}

function spentOn(game: ParsedGame, i: number): number | null {
  const { clocks, timeControl } = game;
  if (!clocks || !timeControl) return null;
  const prev = i >= 2 ? clocks[i - 2] : timeControl.base;
  return Math.max(0, Math.round(prev + timeControl.inc - clocks[i]));
}

/** Material `side` loses over the first plies of a line (positive = lost). */
export function materialSwing(fen: string, pv: string[] | undefined, side: 'w' | 'b', plies = 4): number {
  if (!pv?.length) return 0;
  const c = new Chess(fen);
  let lost = 0;
  for (const u of pv.slice(0, plies)) {
    let m: Move;
    try {
      m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    } catch {
      break;
    }
    if (m.captured) lost += (m.color === side ? -1 : 1) * VALUE[m.captured];
  }
  return lost;
}

/** What went wrong with the move at `i`, in plain words. */
export function diagnose(game: ParsedGame, analysis: GameAnalysis, i: number): { type: MistakeType; explain: string; reply: KeyMoment['reply']; best: KeyMoment['best'] } {
  const me = game.moves[i].color;
  const opp = me === 'w' ? 'b' : 'w';
  const before = game.fens[i];
  const after = game.fens[i + 1];
  const played = game.moves[i];
  const evBefore = analysis.evals[i];
  const evAfter = analysis.evals[i + 1];
  const bestMove = move(before, evBefore.bestMove);
  const best = bestMove ? { san: bestMove.san, uci: evBefore.bestMove! } : null;
  const replyMove = move(after, evAfter?.bestMove);
  const reply = replyMove ? { san: replyMove.san, uci: evAfter.bestMove! } : null;

  const oppMate = evAfter ? mateFor(evAfter, opp) : null;
  if (oppMate && reply) {
    return { type: 'allowed-mate', reply, best, explain: `After ${played.san}, your opponent has checkmate in ${oppMate}${oppMate === 1 ? `: ${reply.san}` : `, starting with ${reply.san}`}.${best ? ` ${best.san} would have stopped it.` : ''}` };
  }
  const myMate = mateFor(evBefore, me);
  if (myMate && best && !(evAfter && mateFor(evAfter, me))) {
    return { type: 'missed-mate', reply, best, explain: `You had checkmate in ${myMate}${myMate === 1 ? `: ${best.san}` : `, starting with ${best.san}`}. ${played.san} let it slip.` };
  }
  if (replyMove?.captured && replyMove.color === opp) {
    const lost = `${NAME[replyMove.captured]} on ${replyMove.to}`;
    const by = `${NAME[replyMove.piece]} on ${replyMove.from}`;
    // a pawn grab that starts something much bigger: describe the bigger thing
    const swing = materialSwing(after, evAfter?.pv, me, 6);
    if (VALUE[replyMove.captured] <= 1 && (swing >= 3 || winFor(evAfter, me) < 20)) {
      const check = new Chess(after).move({ from: replyMove.from, to: replyMove.to, promotion: replyMove.promotion }).san.endsWith('+');
      return {
        type: new Chess(before).isAttacked(replyMove.to as Square, opp) ? 'missed-threat' : 'piece-left',
        reply,
        best,
        explain: `After ${played.san}, ${reply!.san}${check ? ' (check!)' : ''} starts an attack that ${swing >= 3 ? `wins about ${swing} pawns of material` : 'your king can’t survive'}.${best ? ` ${best.san} would have kept you safe.` : ''}`,
      };
    }
    if (replyMove.to === played.to) {
      return { type: 'moved-piece-lost', reply, best, explain: `Your ${NAME[replyMove.captured]} went to ${played.to}, where the ${by} can simply take it (${reply!.san}).${best ? ` Better was ${best.san}.` : ''}` };
    }
    // was it already attacked before your move? then you missed a threat; otherwise your move left it
    const wasAttacked = new Chess(before).isAttacked(replyMove.to as Square, opp);
    if (wasAttacked) {
      return { type: 'missed-threat', reply, best, explain: `Your opponent was already attacking your ${lost}, and ${played.san} didn’t deal with it: ${reply!.san} wins it.${best ? ` ${best.san} was the answer.` : ''}` };
    }
    return { type: 'piece-left', reply, best, explain: `${played.san} left your ${lost} without enough defenders, and the ${by} takes it (${reply!.san}).${best ? ` Better was ${best.san}.` : ''}` };
  }
  if (bestMove?.captured && materialSwing(before, evBefore.pv ?? (evBefore.bestMove ? [evBefore.bestMove] : []), opp, 4) >= 2) {
    return { type: 'missed-material', reply, best, explain: `${best!.san} won material: it takes the ${NAME[bestMove.captured]} on ${bestMove.to}${bestMove.captured === 'p' ? '' : ' for free'}. ${played.san} missed it.` };
  }
  const swing = materialSwing(after, evAfter?.pv, me, 4);
  if (reply && swing >= 2) {
    return { type: 'piece-left', reply, best, explain: `After ${played.san}, ${reply.san} wins material for your opponent (about ${swing} pawn${swing === 1 ? '' : 's'}).${best ? ` Better was ${best.san}.` : ''}` };
  }
  const answer = reply ? ` After it, your opponent’s strongest answer is ${reply.san}.` : '';
  return { type: 'other', reply, best, explain: best ? `${best.san} was much stronger than ${played.san}.${answer}` : `${played.san} gave your opponent the better game.${answer}` };
}

/**
 * The moments that decided the game for `me`: your biggest mistakes and the winning chances you let slip,
 * at most three, in the order they happened. Positions that were already lost don't count.
 */
export function keyMoments(game: ParsedGame, analysis: GameAnalysis, me: 'w' | 'b', max = 3): KeyMoment[] {
  const cands: { i: number; drop: number; wb: number; wa: number }[] = [];
  for (let i = 0; i < game.moves.length; i++) {
    if (game.moves[i].color !== me || !analysis.evals[i + 1]) continue;
    const wb = winFor(analysis.evals[i], me);
    const wa = winFor(analysis.evals[i + 1], me);
    const drop = wb - wa;
    // a real swing (about a mistake or worse), from a position that wasn't already lost
    if (drop >= 14 && wb >= 18) cands.push({ i, drop, wb, wa });
  }
  if (!cands.length) return [];
  const picked = [...cands].sort((a, b) => b.drop - a.drop).slice(0, max);
  // the first one that really mattered is often where it all started: make sure it's in
  const first = cands.find((c) => c.drop >= 20);
  if (first && !picked.includes(first)) picked[picked.length - 1] = first;
  const biggest = picked.reduce((a, b) => (b.drop > a.drop ? b : a));
  return picked
    .sort((a, b) => a.i - b.i)
    .map((c) => {
      const d = diagnose(game, analysis, c.i);
      const kind: MomentKind = c.wb >= 70 || d.type === 'missed-mate' ? 'missed-win' : 'mistake';
      const title = kind === 'missed-win' ? (c.wb >= 90 ? 'You were winning here' : 'A chance you missed') : c === biggest ? 'The move that cost the most' : 'A big mistake';
      return {
        ply: c.i,
        kind,
        title,
        type: d.type,
        played: { san: game.moves[c.i].san, uci: game.moves[c.i].uci },
        best: d.best,
        reply: d.reply,
        explain: d.explain,
        rule: RULES[d.type],
        winBefore: Math.round(c.wb),
        winAfter: Math.round(c.wa),
        spent: spentOn(game, c.i),
      };
    });
}
