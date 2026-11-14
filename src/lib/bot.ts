// A Stockfish opponent at different strengths and styles. Weaker levels search shallower, look at many candidate
// moves and pick by how good each *looks* to them (see botBrain.ts): they like natural moves, now and then don't see
// what they leave hanging or what you offered, so their mistakes are human ones.
import { Engine } from './engine';
import type { EngineLine } from './engine';
import { bookMove, chooseMove } from './botBrain';
import type { Level } from './botBrain';

export { BOTS, LEVELS, STYLE_LABEL, findBot, lockedBy, thinkTime } from './botBrain';
export type { Bot, Level, Style } from './botBrain';

let engine: Engine | null = null;
const getBot = () => (engine ??= new Engine());

const scoreOf = (l: EngineLine) => (l.mate !== null ? (l.mate > 0 ? 100000 - l.mate : -100000 - l.mate) : (l.cp ?? 0));

/**
 * Picks the bot's move (UCI) and reports the evaluation from the side to move's point of view.
 * `history` (SAN from the standard start) lets it play its favourite openings.
 */
export async function botMove(fen: string, level: Level, signal?: AbortSignal, history?: string[]): Promise<{ move: string | null; score: number }> {
  const book = bookMove(level, history);
  if (book) return { move: book, score: 0 };
  const r = await getBot().analyze(fen, level.depth, level.multiPv, signal);
  const lines = r.lines.filter((l) => l.pv[0]);
  if (!lines.length) return { move: r.bestMove, score: 0 };
  const pick = chooseMove(fen, lines.map((l) => ({ uci: l.pv[0], score: scoreOf(l) })), level);
  return { move: pick.uci, score: pick.score };
}

/** Best move for a hint, at a fixed decent depth. */
export async function hintMove(fen: string, signal?: AbortSignal): Promise<string | null> {
  return (await getBot().analyze(fen, 14, 1, signal)).bestMove;
}
