import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { analyzeMany } from './engine';
import type { EngineResult } from './engine';
import { uciToSan } from './chess';
import { KEYS, load, save } from './storage';
import { bookLookup } from './openingIndex';
import { VALUE, materialBalance, playLine, settledBalance } from './tactics';

export type Classification =
  | 'brilliant'
  | 'great'
  | 'book'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder';

/** Classifications that count as a real error worth reviewing (and turning into a puzzle). */
export const isError = (c: Classification) => c === 'mistake' || c === 'miss' || c === 'blunder';

export interface ParsedMove {
  san: string;
  uci: string;
  from: Square;
  to: Square;
  color: 'w' | 'b';
  captured?: boolean;
}

export interface ParsedGame {
  fens: string[];
  moves: ParsedMove[];
  clocks?: number[]; // seconds left after each move (increment already added), from the PGN's [%clk] tags
  timeControl?: { base: number; inc: number }; // seconds; absent for daily games
}

export interface PositionEval {
  cp: number; // always from White's perspective
  mate: number | null;
  bestMove: string | null;
  pv?: string[]; // engine's main line (UCI), first few moves
  second?: { cp: number; move: string }; // best alternative to the move played (White's perspective), for "Great" detection
}

export interface MoveReview {
  classification: Classification;
  winLoss: number; // winning chances lost, 0–100
  cpLoss: number; // centipawns lost, capped at 1000
  accuracy: number;
  bestSan: string | null;
}

export interface GameAnalysis {
  evals: PositionEval[];
  reviews: MoveReview[];
  accuracy: { w: number; b: number };
  acpl: { w: number; b: number }; // average centipawn loss per side
  depth: number;
}

const MATE_CP = 10000;
const CACHE_PREFIX = 'cca-analysis-v3:'; // v3: brilliant/great, centipawn loss, engine lines
export const QUICK_DEPTH = 10;
export const DEEP_DEPTH = 16;
const GREAT_DEPTH = 12;

export interface Puzzle {
  id: string;
  fen: string; // position before the mistake; the solver plays the side to move
  best: string; // UCI
  bestSan: string;
  playedSan: string;
  classification: Classification;
  gameUrl: string;
  moveNo: number;
  date: number;
}

/** Turns a player's mistakes and blunders into puzzles and merges them into the saved puzzle list. */
export function savePuzzlesFrom(game: ParsedGame, analysis: GameAnalysis, color: 'w' | 'b', gameUrl: string, date: number): number {
  const fresh: Puzzle[] = [];
  analysis.reviews.forEach((r, i) => {
    const best = analysis.evals[i].bestMove;
    if (game.moves[i].color !== color || !best) return;
    if (!isError(r.classification)) return;
    fresh.push({
      id: `${gameUrl}#${i}`,
      fen: game.fens[i],
      best,
      bestSan: uciToSan(game.fens[i], best),
      playedSan: game.moves[i].san,
      classification: r.classification,
      gameUrl,
      moveNo: Math.floor(i / 2) + 1,
      date,
    });
  });
  const existing = load<Puzzle[]>(KEYS.puzzles, []);
  const ids = new Set(existing.map((p) => p.id));
  const added = fresh.filter((p) => !ids.has(p.id));
  if (added.length) save(KEYS.puzzles, [...added, ...existing]);
  return added.length;
}

const toSeconds = (clk: string) => clk.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);

export function parseGame(pgn: string): ParsedGame {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const history = chess.history({ verbose: true });
  const fens = history.length ? [history[0].before, ...history.map((m) => m.after)] : [chess.fen()];
  const moves = history.map((m) => ({
    san: m.san,
    uci: m.from + m.to + (m.promotion ?? ''),
    from: m.from,
    to: m.to,
    color: m.color,
    captured: !!m.captured,
  }));
  const clocks = [...pgn.matchAll(/%clk\s+([\d:.]+)/g)].map((m) => toSeconds(m[1]));
  const tc = pgn.match(/\[TimeControl "(\d+)(?:\+(\d+))?"\]/);
  return {
    fens,
    moves,
    clocks: clocks.length === moves.length ? clocks : undefined,
    timeControl: tc ? { base: Number(tc[1]), inc: Number(tc[2] ?? 0) } : undefined,
  };
}

/** "2:58" / "1:02:03" for a number of seconds; tenths below 20 seconds, like a real clock. */
export function formatClock(sec: number): string {
  if (sec < 20) return sec.toFixed(1);
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** Seconds spent on each move (null where the PGN has no clocks). */
export function timeSpent(game: ParsedGame): (number | null)[] {
  const { clocks, timeControl } = game;
  if (!clocks || !timeControl) return game.moves.map(() => null);
  return game.moves.map((_, i) => {
    const prev = i >= 2 ? clocks[i - 2] : timeControl.base;
    return Math.max(0, Math.round((prev + timeControl.inc - clocks[i]) * 10) / 10);
  });
}

export function winPct(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

function terminalEval(fen: string): PositionEval | null {
  const board = new Chess(fen);
  const sign = fen.split(' ')[1] === 'w' ? 1 : -1;
  if (board.isCheckmate()) return { cp: -sign * MATE_CP, mate: 0, bestMove: null };
  if (board.isStalemate() || board.isInsufficientMaterial()) return { cp: 0, mate: null, bestMove: null };
  return null;
}

function toWhiteCp(fen: string, cp: number | null, mate: number | null): { cp: number; mate: number | null } {
  const sign = fen.split(' ')[1] === 'w' ? 1 : -1;
  if (mate !== null) {
    const m = sign * mate;
    return { cp: m > 0 ? MATE_CP : -MATE_CP, mate: m };
  }
  return { cp: sign * (cp ?? 0), mate: null };
}

function toWhite(fen: string, r: EngineResult): PositionEval {
  return { ...toWhiteCp(fen, r.cp, r.mate), bestMove: r.bestMove, pv: r.pv.slice(0, 10) };
}

const clampCp = (p: { cp: number; mate: number | null }) => (p.mate !== null ? Math.sign(p.cp) * 1000 : Math.max(-1000, Math.min(1000, p.cp)));
const moverWin = (color: 'w' | 'b', cp: number) => (color === 'w' ? winPct(cp) : 100 - winPct(cp));

/**
 * Most the opponent can win by capturing right now, net of our immediate recapture and of whatever
 * the move itself captured. 2+ means the move leaves material en prise on purpose.
 */
function materialLeftEnPrise(game: ParsedGame, i: number): number {
  const before = new Chess(game.fens[i]);
  const moved = before.get(game.moves[i].to);
  const gainedByMove = moved ? VALUE[moved.type] : 0; // what our move captured
  const after = new Chess(game.fens[i + 1]);
  const mover = game.moves[i].color;
  let worst = 0;
  for (const cap of after.moves({ verbose: true })) {
    if (!cap.captured) continue;
    const taken = VALUE[cap.captured];
    const recapture = after.attackers(cap.to, mover).length > 0 ? VALUE[cap.piece] : 0;
    worst = Math.max(worst, taken - Math.min(recapture, taken));
  }
  return worst - gainedByMove;
}

/** The move gives up material: either the opponent's best line wins it, or it is left hanging on purpose. */
function isSacrifice(game: ParsedGame, i: number, after: PositionEval): boolean {
  if (materialLeftEnPrise(game, i) >= 2) return true;
  if (!after.pv?.length) return false;
  const mover = game.moves[i].color;
  const before = materialBalance(new Chess(game.fens[i]), mover);
  const line = playLine(game.fens[i + 1], after.pv, mover, 2);
  if (!line.steps[0]?.captured) return false; // the opponent's best reply has to actually take the bait
  return before - settledBalance(line, mover) >= 2;
}

/** Positions where the move played was the engine's choice and it is worth checking whether it was the ONLY good move. */
function isGreatCandidate(game: ParsedGame, i: number, before: PositionEval): boolean {
  const move = game.moves[i];
  if (before.bestMove !== move.uci) return false;
  const w = moverWin(move.color, before.cp);
  if (w < 35 || w > 95) return false; // already lost or trivially winning
  const prev = game.moves[i - 1];
  if (prev?.captured && move.captured && prev.to === move.to) return false; // an obvious recapture
  const board = new Chess(game.fens[i]);
  return !board.inCheck() && board.moves().length > 1; // escaping a check is forced, never an only-move find
}

function reviewMove(game: ParsedGame, i: number, evals: PositionEval[]): MoveReview {
  const move = game.moves[i];
  const before = evals[i];
  const after = evals[i + 1];
  const wBefore = moverWin(move.color, before.cp);
  const wAfter = moverWin(move.color, after.cp);
  const winLoss = Math.max(0, wBefore - wAfter);
  const sign = move.color === 'w' ? 1 : -1;
  const cpLoss = Math.max(0, sign * (clampCp(before) - clampCp(after)));
  const accuracy = Math.min(100, Math.max(0, 103.1668 * Math.exp(-0.04354 * winLoss) - 3.1669));
  const playedBest = before.bestMove === move.uci;

  let classification: Classification;
  if (i < 20 && winLoss < 5 && bookLookup(game.fens[i + 1]).length) classification = 'book';
  else if (
    winLoss < 2 &&
    wAfter >= 50 &&
    // in an already-won position only a sacrifice that forces mate counts (e.g. Morphy's Qb8+)
    (wBefore < 95 || (playedBest && after.mate !== null && (move.color === 'w' ? after.mate > 0 : after.mate < 0))) &&
    isSacrifice(game, i, after)
  )
    classification = 'brilliant';
  else if (
    playedBest &&
    before.second &&
    wBefore - moverWin(move.color, before.second.cp) >= 20 &&
    moverWin(move.color, before.second.cp) <= 70 &&
    isGreatCandidate(game, i, before)
  )
    classification = 'great'; // the only move that keeps the position together
  else if (playedBest) classification = 'best';
  else if (winLoss < 2) classification = 'excellent';
  else if (winLoss < 5) classification = 'good';
  else if (winLoss < 10) classification = 'inaccuracy';
  // you were clearly winning, didn't lose the game, but let most of the advantage slip
  else if (wBefore >= 75 && wAfter >= 45) classification = 'miss';
  else if (winLoss < 20) classification = 'mistake';
  else classification = 'blunder';

  const bestSan = before.bestMove && !playedBest ? uciToSan(game.fens[i], before.bestMove) : null;
  return { classification, winLoss, cpLoss, accuracy, bestSan };
}

function buildAnalysis(game: ParsedGame, evals: PositionEval[], depth: number): GameAnalysis {
  const reviews = game.moves.map((_, i) => reviewMove(game, i, evals));
  const avg = (color: 'w' | 'b', pick: (r: MoveReview) => number, empty: number) => {
    const xs = reviews.filter((_, i) => game.moves[i].color === color).map(pick);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : empty;
  };
  return {
    evals,
    reviews,
    accuracy: { w: avg('w', (r) => r.accuracy, 100), b: avg('b', (r) => r.accuracy, 100) },
    acpl: { w: avg('w', (r) => r.cpLoss, 0), b: avg('b', (r) => r.cpLoss, 0) },
    depth,
  };
}

/**
 * "Played like a ___" estimate for one game.
 *
 * Calibrated on 156 player-games from rated chess.com blitz/rapid (ratings 100–3456): the rating a
 * game's average centipawn loss points to is 6113 − 1112·ln(ACPL + 5), but a single game is a noisy
 * signal (correlation ≈ −0.65), so we anchor on the player's real rating and move it by how much
 * better or worse they played than is typical at that rating (typical = 819 + 0.424·rating).
 * Without a known rating (e.g. historical games) the raw formula is used.
 */
export function estimateGameRating(acpl: number, movesPlayed: number, actual?: number): number {
  const fromGame = 6113 - 1112 * Math.log(acpl + 5);
  let est = fromGame;
  if (actual) {
    const typical = 819 + 0.424 * actual;
    const shift = Math.max(-600, Math.min(600, (0.25 * (fromGame - typical)) / 0.424));
    est = actual + shift * Math.min(1, movesPlayed / 25); // short games say little
  }
  return Math.round(Math.max(100, Math.min(3300, est)) / 10) * 10;
}

export type AnalysisStage = 'quick' | 'deep';

/**
 * Three passes over a pool of engines:
 *  1. a quick shallow pass (well under a second) so the review appears immediately,
 *  2. the full-depth pass that produces the final evaluations,
 *  3. a two-line search on candidate moves to find "Great" only-moves.
 * `onUpdate` receives the quick result, then progress (0–1) of the deep work.
 */
export async function analyzeGame(
  game: ParsedGame,
  onUpdate: (analysis: GameAnalysis | null, stage: AnalysisStage, progress: number) => void,
  signal?: AbortSignal,
): Promise<GameAnalysis | null> {
  const n = game.fens.length;
  const terminal = game.fens.map(terminalEval);
  const todo = game.fens.map((_, i) => i).filter((i) => !terminal[i]);

  // 1. quick pass
  const quick: PositionEval[] = terminal.map((t) => t ?? { cp: 0, mate: null, bestMove: null });
  await analyzeMany(game.fens, todo, QUICK_DEPTH, 1, (i, r) => (quick[i] = toWhite(game.fens[i], r)), signal);
  if (signal?.aborted) return null;
  onUpdate(buildAnalysis(game, quick, QUICK_DEPTH), 'quick', 0);

  // 2. deep pass
  const deep: PositionEval[] = [...quick];
  let done = 0;
  let lastReport = 0;
  await analyzeMany(
    game.fens,
    todo,
    DEEP_DEPTH,
    1,
    (i, r) => {
      deep[i] = toWhite(game.fens[i], r);
      done++;
      if (done - lastReport >= Math.max(1, n / 25)) {
        lastReport = done;
        onUpdate(null, 'deep', (done / todo.length) * 0.85);
      }
    },
    signal,
  );
  if (signal?.aborted) return null;

  // 3. only-move check for "Great"
  const candidates = game.moves.map((_, i) => i).filter((i) => isGreatCandidate(game, i, deep[i]));
  await analyzeMany(
    game.fens,
    candidates,
    GREAT_DEPTH,
    2,
    (i, r) => {
      const played = game.moves[i].uci;
      const alt = r.lines.find((l) => l.pv[0] && l.pv[0] !== played);
      if (alt) deep[i] = { ...deep[i], second: { cp: toWhiteCp(game.fens[i], alt.cp, alt.mate).cp, move: alt.pv[0] } };
    },
    signal,
  );
  if (signal?.aborted) return null;
  onUpdate(null, 'deep', 1);
  return buildAnalysis(game, deep, DEEP_DEPTH);
}

export function loadCached(key: string, depth: number): GameAnalysis | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const a = JSON.parse(raw) as GameAnalysis;
    return a.depth >= depth ? a : null;
  } catch {
    return null;
  }
}

/** Small url → [white, black] accuracy map, so game lists can show accuracy without parsing full analyses. */
export function accuracyIndex(): Record<string, [number, number]> {
  return load(KEYS.accuracy, {});
}

export function saveCached(key: string, analysis: GameAnalysis): void {
  save(KEYS.accuracy, { ...accuracyIndex(), [key]: [analysis.accuracy.w, analysis.accuracy.b] });
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(analysis));
  } catch {
    // storage full: skip caching
  }
}
