// The clock and tilt coach: how you use your time (from the clock times chess.com stores in every game) and
// whether you're on a losing streak. Pure functions over chess.com games, so they can be tested in Node.
import type { ChessComGame } from './chesscom';

export interface GameClock {
  url: string;
  end: number; // ms
  timeClass: string;
  base: number; // seconds
  used: number; // seconds you spent on your moves
  usedPct: number; // of the base time
  moves: number; // your moves with a clock time
  fast: number; // of them, played in under 5 seconds
  outcome: 'win' | 'loss' | 'draw';
}

const DRAWS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']);
const FAST = 5; // seconds
export const GOALS = { usedPct: 60, fastShare: 20 }; // rapid: use at least 60% of your clock; under 20% of moves in < 5 s
/** Goals per time control: blitz needs quick moves, so its fast-move goal is looser. */
export const goalsFor = (timeClass: string) => (timeClass === 'blitz' ? { usedPct: 60, fastShare: 45 } : GOALS);

const seconds = (c: string) => c.split(':').reduce((a, x) => a * 60 + Number(x), 0);

/** Your clock use in one game (null for daily games and games without clock times). */
export function gameClock(g: ChessComGame, user: string): GameClock | null {
  if (g.time_class === 'daily') return null;
  const [baseS, incS] = g.time_control.split('+');
  const base = Number(baseS);
  const inc = Number(incS ?? 0);
  if (!base) return null;
  const clocks = [...g.pgn.matchAll(/\[%clk ([0-9:.]+)\]/g)].map((m) => seconds(m[1]));
  if (clocks.length < 4) return null;
  const white = g.white.username.toLowerCase() === user.toLowerCase();
  const mine = clocks.filter((_, i) => (i % 2 === 0) === white);
  let prev = base;
  let fast = 0;
  let used = 0;
  for (const t of mine) {
    const spent = Math.max(0, prev + inc - t);
    used += spent;
    if (spent < FAST) fast++;
    prev = t;
  }
  return {
    url: g.url,
    end: g.end_time * 1000,
    timeClass: g.time_class,
    base,
    used: Math.round(used),
    usedPct: Math.min(100, Math.round((used / base) * 100)),
    moves: mine.length,
    fast,
    outcome: outcomeOf(g, user),
  };
}

function outcomeOf(g: ChessComGame, user: string): 'win' | 'loss' | 'draw' {
  const r = (g.white.username.toLowerCase() === user.toLowerCase() ? g.white : g.black).result;
  return r === 'win' ? 'win' : DRAWS.has(r) ? 'draw' : 'loss';
}

export interface ClockSummary {
  games: number;
  usedPct: number; // average share of the clock used
  usedMin: number; // average minutes used
  baseMin: number; // the usual base time
  fastShare: number; // share of all your moves played in under 5 s
  usedOk: boolean;
  fastOk: boolean;
  goals: { usedPct: number; fastShare: number };
  recent: GameClock[]; // newest first, up to 10
}

/** Your clock habits in one time control over the last `days` days (games newest first or in any order). */
export function clockSummary(games: ChessComGame[], user: string, timeClass: string, days = 7, now = Date.now()): ClockSummary | null {
  const list = games
    .filter((g) => g.time_class === timeClass && g.end_time * 1000 >= now - days * 86400_000)
    .map((g) => gameClock(g, user))
    .filter((x): x is GameClock => !!x)
    .sort((a, b) => b.end - a.end);
  if (!list.length) return null;
  const moves = list.reduce((a, g) => a + g.moves, 0);
  const fast = list.reduce((a, g) => a + g.fast, 0);
  const usedPct = Math.round(list.reduce((a, g) => a + g.usedPct, 0) / list.length);
  const fastShare = Math.round((fast / Math.max(1, moves)) * 100);
  const bases = list.map((g) => g.base).sort((a, b) => a - b);
  const goals = goalsFor(timeClass);
  return {
    games: list.length,
    usedPct,
    usedMin: Math.round((list.reduce((a, g) => a + g.used, 0) / list.length / 60) * 10) / 10,
    baseMin: Math.round(bases[Math.floor(bases.length / 2)] / 60),
    fastShare,
    usedOk: usedPct >= goals.usedPct,
    fastOk: fastShare < goals.fastShare,
    goals,
    recent: list.slice(0, 10),
  };
}

export interface Tilt {
  streak: number; // losses in a row, ending with your latest game
  minutesAgo: number; // since your latest game ended
  stop: boolean; // 2+ losses in a row and the last one was within the hour
  afterLoss: { games: number; winRate: number } | null; // games started within an hour of a loss
  afterWin: { games: number; winRate: number } | null;
}

/** Losing streaks, and how you do when you play straight after a loss (games of any time control except daily). */
export function tiltCheck(games: ChessComGame[], user: string, now = Date.now()): Tilt | null {
  // results only (a game resigned after three moves counts too)
  const list = games
    .filter((g) => g.time_class !== 'daily')
    .map((g) => ({ end: g.end_time * 1000, outcome: outcomeOf(g, user) }))
    .sort((a, b) => a.end - b.end);
  if (!list.length) return null;
  let streak = 0;
  for (let i = list.length - 1; i >= 0 && list[i].outcome === 'loss'; i--) streak++;
  const latest = list[list.length - 1];
  const minutesAgo = Math.round((now - latest.end) / 60000);
  const after = { loss: { n: 0, w: 0 }, win: { n: 0, w: 0 } };
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1];
    if (prev.outcome === 'draw' || list[i].end - prev.end > 3600_000) continue;
    after[prev.outcome].n++;
    if (list[i].outcome === 'win') after[prev.outcome].w++;
  }
  const rate = (x: { n: number; w: number }) => (x.n >= 4 ? { games: x.n, winRate: Math.round((x.w / x.n) * 100) } : null);
  return { streak, minutesAgo, stop: streak >= 2 && minutesAgo <= 60, afterLoss: rate(after.loss), afterWin: rate(after.win) };
}
