// Advanced stats: the numbers behind your results that a plain win/loss count hides. Accuracy by phase,
// converting won positions, opponents stronger and weaker than you, when you play best, which piece
// blunders, how you spend your clock. Pure functions over games and analyses.
import { phaseOf } from './tactics.ts';
import type { GameAnalysis, ParsedGame } from './analysis';
import type { AnalyzedGame, GameRow } from './insights';

export interface Bucket {
  label: string;
  n: number;
  score: number; // % of points scored (win 1, draw ½)
  w: number;
  d: number;
  l: number;
}

const pts = (r: GameRow) => (r.outcome === 'win' ? 1 : r.outcome === 'draw' ? 0.5 : 0);
function bucket(label: string, rows: GameRow[]): Bucket {
  const w = rows.filter((r) => r.outcome === 'win').length;
  const d = rows.filter((r) => r.outcome === 'draw').length;
  return { label, n: rows.length, w, d, l: rows.length - w - d, score: rows.length ? Math.round((rows.reduce((s, r) => s + pts(r), 0) / rows.length) * 100) : 0 };
}

const winPct = (cp: number) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1); // as in analysis.ts

export type Phase = 'opening' | 'middlegame' | 'endgame';
export const PHASES: Phase[] = ['opening', 'middlegame', 'endgame'];

/** Your average accuracy in each phase of one game (null where the game never reached that phase). */
export function gamePhaseAccuracy(parsed: ParsedGame, analysis: GameAnalysis, color: 'w' | 'b'): Record<Phase, number | null> {
  const sums: Record<Phase, [number, number]> = { opening: [0, 0], middlegame: [0, 0], endgame: [0, 0] };
  analysis.reviews.forEach((r, i) => {
    if (parsed.moves[i]?.color !== color || r.classification === 'book') return;
    const p = phaseOf(parsed.fens[i], i);
    sums[p][0] += r.accuracy;
    sums[p][1]++;
  });
  return Object.fromEntries(PHASES.map((p) => [p, sums[p][1] >= 2 ? sums[p][0] / sums[p][1] : null])) as Record<Phase, number | null>;
}

/** Accuracy per phase over many games, weighted by moves; also how many games reached each phase. */
export function phaseAccuracy(items: AnalyzedGame[]): Record<Phase, { accuracy: number | null; games: number }> {
  const out = Object.fromEntries(PHASES.map((p) => [p, { sum: 0, n: 0, games: 0 }])) as Record<Phase, { sum: number; n: number; games: number }>;
  for (const it of items) {
    const seen = new Set<Phase>();
    it.analysis.reviews.forEach((r, i) => {
      if (it.parsed.moves[i]?.color !== it.row.color || r.classification === 'book') return;
      const p = phaseOf(it.parsed.fens[i], i);
      out[p].sum += r.accuracy;
      out[p].n++;
      seen.add(p);
    });
    seen.forEach((p) => out[p].games++);
  }
  return Object.fromEntries(PHASES.map((p) => [p, { accuracy: out[p].n >= 5 ? out[p].sum / out[p].n : null, games: out[p].games }])) as Record<Phase, { accuracy: number | null; games: number }>;
}

/**
 * Converting and saving: of the games where you were clearly winning (≥ 80% winning chances, about +3) at
 * some point, how many you won; of those where you were clearly lost, how many you saved.
 */
export function conversion(items: AnalyzedGame[]) {
  let winning = 0, converted = 0, losing = 0, saved = 0;
  for (const it of items) {
    const mine = (cp: number) => (it.row.color === 'w' ? winPct(cp) : 100 - winPct(cp));
    // skip the last few plies: a finished game's final eval says nothing about the fight
    const evals = it.analysis.evals.slice(0, Math.max(0, it.analysis.evals.length - 1));
    const best = Math.max(...evals.map((e) => mine(e.cp)));
    const worst = Math.min(...evals.map((e) => mine(e.cp)));
    if (best >= 80) {
      winning++;
      if (it.row.outcome === 'win') converted++;
    }
    if (worst <= 20) {
      losing++;
      if (it.row.outcome !== 'loss') saved++;
    }
  }
  return { winning, converted, losing, saved, convertPct: winning ? Math.round((converted / winning) * 100) : null, savePct: losing ? Math.round((saved / losing) * 100) : null };
}

/** Score against opponents rated above and below you. */
export function byOpponent(rows: GameRow[]): Bucket[] {
  const bands: [string, (d: number) => boolean][] = [
    ['200+ lower', (d) => d <= -200],
    ['50–200 lower', (d) => d > -200 && d <= -50],
    ['About equal', (d) => d > -50 && d < 50],
    ['50–200 higher', (d) => d >= 50 && d < 200],
    ['200+ higher', (d) => d >= 200],
  ];
  return bands.map(([label, f]) => bucket(label, rows.filter((r) => f(r.oppRating - r.myRating)))).filter((b) => b.n > 0);
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function byWeekday(rows: GameRow[]): Bucket[] {
  return [1, 2, 3, 4, 5, 6, 0].map((d) => bucket(DAYS[d], rows.filter((r) => r.date.getDay() === d))).filter((b) => b.n > 0);
}

export function byHour(rows: GameRow[]): Bucket[] {
  const bands: [string, number, number][] = [['Night (0–6)', 0, 6], ['Morning (6–12)', 6, 12], ['Afternoon (12–18)', 12, 18], ['Evening (18–24)', 18, 24]];
  return bands.map(([label, a, b]) => bucket(label, rows.filter((r) => r.date.getHours() >= a && r.date.getHours() < b))).filter((x) => x.n > 0);
}

/** Moves in a chess.com PGN (full moves), read from the move numbers without parsing the game. */
export function moveCount(pgn: string): number {
  const nums = [...pgn.matchAll(/(?:^|\s)(\d+)\.(?!\.)/g)].map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : 0;
}

export function byLength(rows: GameRow[]): Bucket[] {
  const bands: [string, number, number][] = [['Under 25 moves', 0, 25], ['25–40 moves', 25, 40], ['40–60 moves', 40, 60], ['60+ moves', 60, 1e9]];
  const len = rows.map((r) => ({ r, n: moveCount(r.game.pgn) }));
  return bands.map(([label, a, b]) => bucket(label, len.filter((x) => x.n >= a && x.n < b).map((x) => x.r))).filter((x) => x.n > 0);
}

const PIECE: Record<string, string> = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
/** Which piece you moved when you made a mistake or blunder. */
export function blunderPieces(items: AnalyzedGame[]): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const it of items)
    it.analysis.reviews.forEach((r, i) => {
      const mv = it.parsed.moves[i];
      if (mv?.color !== it.row.color || !['mistake', 'blunder', 'miss'].includes(r.classification)) return;
      const piece = mv.san.startsWith('O-O') ? 'k' : /^[NBRQK]/.test(mv.san) ? mv.san[0].toLowerCase() : 'p';
      m.set(PIECE[piece], (m.get(PIECE[piece]) ?? 0) + 1);
    });
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

/** Average accuracy in your wins, draws and losses. */
export function accuracyByResult(items: AnalyzedGame[]): { label: string; value: number; n: number }[] {
  return (['win', 'draw', 'loss'] as const)
    .map((o) => {
      const xs = items.filter((i) => i.row.outcome === o).map((i) => i.analysis.accuracy[i.row.color]);
      return { label: o === 'win' ? 'Wins' : o === 'draw' ? 'Draws' : 'Losses', value: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0, n: xs.length };
    })
    .filter((x) => x.n > 0);
}

const secs = (c: string) => c.split(':').reduce((a, x) => a * 60 + Number(x), 0);
/** Average seconds you spend per move in each stretch of the game, from the clock times in the PGNs. */
export function timePerMove(rows: GameRow[]): { label: string; value: number; n: number }[] {
  const bands: [string, number, number][] = [['Moves 1–10', 1, 10], ['11–20', 11, 20], ['21–30', 21, 30], ['31–40', 31, 40], ['41+', 41, 1e9]];
  const acc = bands.map(() => ({ sum: 0, n: 0 }));
  for (const r of rows) {
    const [baseS, incS] = r.game.time_control.split('+');
    const base = Number(baseS);
    const inc = Number(incS ?? 0);
    if (!base || r.timeClass === 'daily') continue;
    const clocks = [...r.game.pgn.matchAll(/\[%clk ([0-9:.]+)\]/g)].map((m) => secs(m[1]));
    const mine = clocks.filter((_, i) => (i % 2 === 0) === (r.color === 'w'));
    let prev = base;
    mine.forEach((t, k) => {
      const spent = Math.max(0, prev + inc - t);
      prev = t;
      const b = bands.findIndex(([, a, z]) => k + 1 >= a && k + 1 <= z);
      if (b >= 0) {
        acc[b].sum += spent;
        acc[b].n++;
      }
    });
  }
  return bands.map(([label], i) => ({ label, value: acc[i].n ? acc[i].sum / acc[i].n : 0, n: acc[i].n })).filter((x) => x.n > 0);
}

/** One line on the strongest signal in a set of buckets, e.g. "You score 71% on Saturdays, 38% on Tuesdays." */
export function spread(buckets: Bucket[], min = 5): { best: Bucket; worst: Bucket } | null {
  const xs = buckets.filter((b) => b.n >= min);
  if (xs.length < 2) return null;
  const sorted = [...xs].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  return best.score - worst.score >= 12 ? { best, worst } : null;
}

export interface ControlStats extends Bucket {
  accuracy: number | null; // average accuracy over the analysed games (null when none are)
  analysed: number;
}
export const TIME_CONTROLS = ['bullet', 'blitz', 'rapid', 'daily'];

/** Score and accuracy in each time control you play, fastest first. `accuracyOf` gives a game's accuracy if it's analysed. */
export function byTimeControl(rows: GameRow[], accuracyOf: (r: GameRow) => number | null | undefined = () => null): ControlStats[] {
  return TIME_CONTROLS.map((tc) => {
    const xs = rows.filter((r) => r.timeClass === tc);
    const accs = xs.map(accuracyOf).filter((a): a is number => typeof a === 'number');
    return { ...bucket(tc[0].toUpperCase() + tc.slice(1), xs), accuracy: accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : null, analysed: accs.length };
  }).filter((b) => b.n > 0);
}

// ── Puzzles ──
export type ThemeResults = Record<string, { ok: number; miss: number }>; // theme → rated attempts solved and missed
// lichess tags that describe a puzzle's length, evaluation or source rather than a tactic
const META_THEMES = new Set(['short', 'long', 'veryLong', 'oneMove', 'advantage', 'crushing', 'equality', 'master', 'masterVsMaster', 'superGM', 'middlegame']);

/** Success rate per puzzle theme with at least `min` attempts, weakest first (ties: the more played first). */
export function themeSuccess(results: ThemeResults, min = 3): { theme: string; ok: number; miss: number; n: number; pct: number }[] {
  return Object.entries(results)
    .filter(([t]) => !META_THEMES.has(t))
    .map(([theme, { ok = 0, miss = 0 }]) => ({ theme, ok, miss, n: ok + miss, pct: ok + miss ? Math.round((ok / (ok + miss)) * 100) : 0 }))
    .filter((x) => x.n >= min)
    .sort((a, b) => a.pct - b.pct || b.n - a.n);
}
