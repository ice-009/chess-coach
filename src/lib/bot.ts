// A Stockfish opponent at different strengths. Weaker levels search shallower, look at several
// candidate moves and pick among them with some randomness, so they make human-like inaccuracies.
import { Engine } from './engine';
import type { EngineLine } from './engine';

export interface Level {
  id: number;
  name: string;
  note: string;
  depth: number;
  multiPv: number;
  temperature: number; // centipawns: how far from the best move it is willing to stray
  blunder: number; // chance of picking a random candidate regardless of quality
}

export const LEVELS: Level[] = [
  { id: 1, name: 'Beginner', note: 'Misses simple tactics often', depth: 5, multiPv: 6, temperature: 260, blunder: 0.22 },
  { id: 2, name: 'Novice', note: 'Plays sensibly but blunders', depth: 6, multiPv: 5, temperature: 160, blunder: 0.12 },
  { id: 3, name: 'Casual', note: 'A typical online club player', depth: 8, multiPv: 4, temperature: 90, blunder: 0.06 },
  { id: 4, name: 'Club', note: 'Solid, occasional slips', depth: 10, multiPv: 3, temperature: 50, blunder: 0.03 },
  { id: 5, name: 'Strong club', note: 'Punishes most mistakes', depth: 12, multiPv: 3, temperature: 25, blunder: 0.01 },
  { id: 6, name: 'Expert', note: 'Very few mistakes', depth: 14, multiPv: 2, temperature: 10, blunder: 0 },
  { id: 7, name: 'Master', note: 'Full strength, quick', depth: 16, multiPv: 1, temperature: 0, blunder: 0 },
  { id: 8, name: 'Maximum', note: 'Best defence (used in drills)', depth: 20, multiPv: 1, temperature: 0, blunder: 0 },
];

let engine: Engine | null = null;
const getBot = () => (engine ??= new Engine());

const scoreOf = (l: EngineLine) => (l.mate !== null ? (l.mate > 0 ? 100000 - l.mate : -100000 - l.mate) : (l.cp ?? 0));

/** Picks the bot's move (UCI) and reports the evaluation from the side to move's point of view. */
export async function botMove(fen: string, level: Level, signal?: AbortSignal): Promise<{ move: string | null; score: number }> {
  const r = await getBot().analyze(fen, level.depth, level.multiPv, signal);
  const lines = r.lines.filter((l) => l.pv[0]);
  if (!lines.length) return { move: r.bestMove, score: 0 };
  const best = scoreOf(lines[0]);
  if (level.temperature === 0 || lines.length === 1) return { move: lines[0].pv[0], score: best };
  if (Math.random() < level.blunder) {
    const pick = lines[Math.floor(Math.random() * lines.length)];
    return { move: pick.pv[0], score: scoreOf(pick) };
  }
  // softmax over how much worse each candidate is than the best
  const weights = lines.map((l) => Math.exp(-Math.min(2000, best - scoreOf(l)) / level.temperature));
  let x = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lines.length; i++) {
    x -= weights[i];
    if (x <= 0) return { move: lines[i].pv[0], score: scoreOf(lines[i]) };
  }
  return { move: lines[0].pv[0], score: best };
}

/** Best move for a hint, at a fixed decent depth. */
export async function hintMove(fen: string, signal?: AbortSignal): Promise<string | null> {
  return (await getBot().analyze(fen, 14, 1, signal)).bestMove;
}
