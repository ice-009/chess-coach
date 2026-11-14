// The coach that sits next to you while you play a bot: it warns you before a blunder counts, points out what
// your opponent threatens, grades each of your moves and gives hints in steps (idea → piece → move).
// It has its own engine so it never slows the bot down.
import { Chess } from 'chess.js';
import { Engine } from './engine';
import type { EngineResult } from './engine';
import type { Classification } from './analysis';
import { explainUnsafe, verdictOf } from './safety';
import { drawbacks, passTurn, whyMove } from './moveReasons';
import type { Reason, ReasonKind } from './moveReasons';
import { NAME, materialSwing } from './keyMoments';

const DEPTH = 12;

let engine: Engine | null = null;
const getCoachEngine = () => (engine ??= new Engine());

export interface Grade {
  classification: Classification;
  loss: number; // winning chances thrown away, in percentage points
  warn: string | null; // set when the move is a blunder worth taking back
  text: string; // what the coach says about it
  bestSan: string | null;
  bestUci: string | null;
}

export interface Hint {
  idea: string;
  from: string | null;
  uci: string | null;
}

const ply = (fen: string) => (Number(fen.split(' ')[5]) - 1) * 2 + (fen.split(' ')[1] === 'b' ? 1 : 0);
const san = (fen: string, uci: string) => {
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return uci;
  }
};
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** One search of a position, remembered so the same position is never searched twice. */
const cache = new Map<string, Promise<EngineResult>>();
export function evaluate(fen: string): Promise<EngineResult> {
  const key = fen.split(' ').slice(0, 4).join(' ');
  let p = cache.get(key);
  if (!p) {
    p = getCoachEngine().analyze(fen, DEPTH, 1);
    cache.set(key, p);
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
  }
  return p;
}

function classify(loss: number, best: boolean): Classification {
  if (best) return 'best';
  if (loss < 2) return 'excellent';
  if (loss < 5) return 'good';
  if (loss < 10) return 'inaccuracy';
  if (loss < 20) return 'mistake';
  return 'blunder';
}

const IDEA: Partial<Record<Reason['theme'], string>> = {
  mate: 'There is a checkmate! Look at every check.',
  material: 'You can win material. Look at captures and at pieces that aren’t defended.',
  fork: 'Look for a fork: one piece attacking two things at once.',
  pin: 'Look for a pin against a piece stuck in front of something more valuable.',
  defend: 'Something of yours is in danger. What does your opponent threaten?',
  threat: 'Find a move that attacks something and makes your opponent react.',
  castle: 'Think about your king: is it safe in the centre?',
  develop: 'Bring another piece into the game.',
  center: 'Fight for the centre with a pawn.',
  'open-file': 'Your rooks want an open file.',
  seventh: 'Your heavy pieces would love the 7th rank.',
  outpost: 'There is a great square for one of your pieces where no pawn can chase it away.',
  bishop: 'Your bishop could be much more active.',
  'passed-pawn': 'Passed pawns must be pushed.',
  'pawn-break': 'A pawn break would open lines for your pieces.',
  'king-activity': 'In the endgame, bring your king toward the centre.',
  trade: 'You are ahead: trading pieces brings you closer to a win.',
  improve: 'Improve your worst-placed piece.',
};

/** Finer hints for ideas that share a theme (a prophylactic move is a 'defend', but nothing is attacked yet). */
const KIND_IDEA: Partial<Record<ReasonKind, string>> = {
  prophylaxis: 'What does your opponent want to play next? Stop it before it happens.',
  space: 'Gain space with a pawn: take squares away from your opponent’s pieces.',
  'worst-piece': 'Which of your pieces has the fewest squares? Give it a better one.',
  simplify: 'You are ahead: look for a trade, because every trade brings you closer to a won endgame.',
};

/** The hint for the side to move, from the coach's search of the position. */
export async function hint(fen: string): Promise<Hint> {
  const r = await evaluate(fen);
  if (!r.bestMove) return { idea: 'Look for checks, captures and threats, for both sides.', from: null, uci: null };
  const reasons = whyMove(fen, r.bestMove, r.pv, { ply: ply(fen), mate: r.mate !== null && r.mate > 0 ? r.mate : null });
  const idea = (reasons[0] && ((reasons[0].kind && KIND_IDEA[reasons[0].kind]) || IDEA[reasons[0].theme])) ?? 'Look for checks, captures and threats, for both sides. Then improve your worst piece.';
  return { idea, from: r.bestMove.slice(0, 2), uci: r.bestMove };
}

/**
 * Grades the move `uci` played in `fen`. A blunder comes with a warning that explains the refutation, so
 * the player can take it back before the bot answers.
 */
export async function grade(fen: string, uci: string): Promise<Grade> {
  const c = new Chess(fen);
  const move = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  const [before, after] = await Promise.all([evaluate(fen), evaluate(c.fen())]);
  const isBest = before.bestMove === uci;
  const terminal = c.isCheckmate() ? { cp: null, mate: -0 } : c.isDraw() ? { cp: 0, mate: null } : null;
  const afterScore = terminal ?? { cp: after.cp, mate: after.mate };
  const { loss } = c.isCheckmate() ? { loss: 0 } : verdictOf({ cp: before.cp, mate: before.mate }, afterScore);
  const classification = c.isCheckmate() ? 'best' : classify(loss, isBest);
  const bestUci = before.bestMove;
  const bestSan = bestUci && !isBest ? san(fen, bestUci) : null;
  const pv = [uci, ...after.pv];
  const reasons = whyMove(fen, uci, pv, { ply: ply(fen), mate: after.mate !== null && after.mate < 0 ? -after.mate + 1 : null });
  const bestReasons = bestUci && !isBest ? whyMove(fen, bestUci, before.pv, { ply: ply(fen), mate: before.mate !== null && before.mate > 0 ? before.mate : null }) : [];
  const better = bestSan ? ` ${bestSan} was better${bestReasons[0] ? `: ${lower(bestReasons[0].text)}` : '.'}` : '';
  const flaw = !isBest ? drawbacks(fen, uci, { ply: ply(fen) })[0] : undefined;
  const worse = flaw ? ` ${flaw.text}` : '';

  let warn: string | null = null;
  let text: string;
  // already lost positions get no warnings: everything loses there
  const lostAlready = before.mate !== null ? before.mate < 0 : (before.cp ?? 0) < -500;
  if (classification === 'blunder' && !lostAlready) {
    warn = explainUnsafe(fen, uci, after.bestMove, after.pv.slice(1), after.mate);
    text = `${move.san} is a blunder. ${warn}${better}`;
  } else if (classification === 'mistake') text = `${move.san} is a mistake.${worse}${better || (worse ? '' : ' Your position got worse.')}`;
  else if (classification === 'inaccuracy') text = `${move.san} is OK, but not the most precise.${worse}${better}`;
  else if (c.isCheckmate()) text = `${move.san} is checkmate. Brilliant finish!`;
  else if (reasons[0]) text = `${isBest ? 'Best move!' : classification === 'excellent' ? 'Excellent!' : 'Good.'} ${reasons[0].text}`;
  else text = isBest ? `${move.san} is the best move.` : `${move.san} is ${classification === 'excellent' ? 'an excellent' : 'a good'} move.`;
  return { classification, loss, warn, text, bestSan, bestUci };
}

/**
 * What the opponent threatens in `fen` (you to move): the move they would play if you passed, when it
 * mates or wins material. Null when there is nothing to worry about.
 */
export async function threat(fen: string): Promise<{ text: string; uci: string } | null> {
  const c = new Chess(fen);
  if (c.inCheck()) return null; // the check itself is the threat, and the board shows it
  const passed = passTurn(fen);
  if (!passed) return null;
  const r = await evaluate(passed);
  if (!r.bestMove) return null;
  const me = c.turn();
  const s = san(passed, r.bestMove);
  if (r.mate !== null && r.mate > 0) {
    return { uci: r.bestMove, text: r.mate === 1 ? `Watch out: your opponent threatens ${s}, checkmate!` : `Watch out: your opponent threatens a mating attack starting with ${s}.` };
  }
  const swing = materialSwing(passed, r.pv, me, 4);
  if (swing < 2) return null;
  const first = new Chess(passed).move({ from: r.bestMove.slice(0, 2), to: r.bestMove.slice(2, 4), promotion: r.bestMove[4] });
  const what = first.captured ? `your ${NAME[first.captured]} on ${first.to}` : `about ${swing} points of material`;
  return { uci: r.bestMove, text: `Watch out: your opponent threatens ${s}, winning ${what}.` };
}
