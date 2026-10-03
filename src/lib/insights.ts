// The weakness report: what your results, openings and mistakes say about where your rating points go.
import { summarize } from './chesscom';
import type { ChessComGame } from './chesscom';
import { estimateGameRating } from './analysis';
import type { GameAnalysis, ParsedGame } from './analysis';
import type { CoachReport, ReasonKind } from './coach';

export interface GameRow {
  game: ChessComGame;
  color: 'w' | 'b';
  outcome: 'win' | 'loss' | 'draw';
  family: string;
  date: Date;
  myRating: number;
  oppRating: number;
  timeClass: string;
  endReason: string; // how the game ended, from the loser's code
}

/** "Sicilian Defense Kan Modern Variation…" → "Sicilian Defense": the name up to its first family word. */
export function openingFamily(name: string): string {
  const words = name.replace(/\.\.\..*$/, '').split(' ');
  const i = words.findIndex((w) => /^(Defense|Defence|Opening|Game|Gambit|Attack|System)$/.test(w));
  return (i >= 0 ? words.slice(0, i + 1) : words.slice(0, 3)).join(' ') || 'Unknown';
}

const REASON_LABEL: Record<string, string> = {
  checkmated: 'checkmated',
  resigned: 'resigned',
  timeout: 'lost on time',
  abandoned: 'abandoned',
  agreed: 'draw agreed',
  repetition: 'repetition',
  stalemate: 'stalemate',
  insufficient: 'insufficient material',
  timevsinsufficient: 'timeout vs insufficient material',
  '50move': '50-move rule',
};

export function gameRows(games: ChessComGame[], user: string): GameRow[] {
  return games.map((g) => {
    const s = summarize(g, user);
    const loserCode = s.outcome === 'win' ? s.opp.result : s.me.result;
    return {
      game: g,
      color: s.color === 'white' ? 'w' : 'b',
      outcome: s.outcome,
      family: openingFamily(s.opening),
      date: s.date,
      myRating: s.me.rating,
      oppRating: s.opp.rating,
      timeClass: g.time_class,
      endReason: REASON_LABEL[loserCode] ?? loserCode,
    };
  });
}

export interface Record3 {
  n: number;
  w: number;
  d: number;
  l: number;
}
const tally = (rows: GameRow[]): Record3 => ({
  n: rows.length,
  w: rows.filter((r) => r.outcome === 'win').length,
  d: rows.filter((r) => r.outcome === 'draw').length,
  l: rows.filter((r) => r.outcome === 'loss').length,
});
export const scorePct = (r: Record3) => (r.n ? Math.round(((r.w + r.d / 2) / r.n) * 100) : 0);

export function overview(rows: GameRow[]) {
  return { all: tally(rows), white: tally(rows.filter((r) => r.color === 'w')), black: tally(rows.filter((r) => r.color === 'b')) };
}

/** How your losses ended, and how your wins ended. */
export function endings(rows: GameRow[]) {
  const count = (rs: GameRow[]) => {
    const m = new Map<string, number>();
    rs.forEach((r) => m.set(r.endReason, (m.get(r.endReason) ?? 0) + 1));
    return [...m.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
  };
  return { losses: count(rows.filter((r) => r.outcome === 'loss')), wins: count(rows.filter((r) => r.outcome === 'win')) };
}

export interface OpeningStat extends Record3 {
  family: string;
  color: 'w' | 'b';
  score: number;
  line: string[]; // first moves (SAN) of your latest game with this opening
}

/** First `plies` SAN moves of a PGN's movetext, without parsing the whole game. */
function firstMoves(pgn: string, plies: number): string[] {
  const text = pgn.split('\n\n').slice(1).join(' ').replace(/\{[^}]*\}/g, ' ');
  return text
    .replace(/\d+\.(\.\.)?/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t))
    .slice(0, plies);
}

export function openingStats(rows: GameRow[]): OpeningStat[] {
  const m = new Map<string, GameRow[]>();
  rows.forEach((r) => {
    const k = `${r.color}|${r.family}`;
    m.set(k, [...(m.get(k) ?? []), r]);
  });
  return [...m.entries()]
    .map(([k, rs]) => {
      const t = tally(rs);
      const latest = rs.reduce((a, b) => (+b.date > +a.date ? b : a));
      return { family: k.slice(2), color: k[0] as 'w' | 'b', ...t, score: scorePct(t), line: firstMoves(latest.game.pgn, 10) };
    })
    .sort((a, b) => b.n - a.n);
}

export interface AnalyzedGame {
  row: GameRow;
  parsed: ParsedGame;
  analysis: GameAnalysis;
  report: CoachReport;
}

const CAUSE_LABEL: Record<string, string> = {
  'hung-piece': 'Hung a piece',
  'allowed-tactic': 'Allowed a tactic',
  'allowed-mate': 'Allowed a checkmate',
  'missed-win': 'Missed a win',
  'missed-mate': 'Missed a mate',
  positional: 'Worsened the position (no material lost)',
};
const TIME_LABEL: Record<string, string> = {
  premove: 'Premoved',
  rushed: 'Rushed (much faster than usual)',
  'time-trouble': 'In time trouble',
  'long-think': 'Long think, still wrong',
  normal: 'Normal thinking time',
};

export function aggregate(items: AnalyzedGame[]) {
  const n = items.length || 1;
  const all = items.flatMap((i) => i.report.insights);
  const by = <T extends string>(key: (x: (typeof all)[number]) => T, labels: Record<string, string>) => {
    const m = new Map<string, number>();
    all.forEach((x) => m.set(key(x), (m.get(key(x)) ?? 0) + 1));
    return [...m.entries()].filter(([k]) => labels[k]).map(([k, count]) => ({ key: k, label: labels[k], count })).sort((a, b) => b.count - a.count);
  };
  const reasonCounts = new Map<ReasonKind, number>();
  items.forEach((i) => i.report.reasons.slice(0, 2).forEach((r) => reasonCounts.set(r.kind, (reasonCounts.get(r.kind) ?? 0) + 1)));
  const accuracy = items.map((i) => ({ date: i.row.date, value: i.analysis.accuracy[i.row.color], url: i.row.game.url }));
  const gameRatings = items.map((i) => {
    const c = i.row.color;
    const played = i.analysis.reviews.filter((r, k) => i.parsed.moves[k].color === c && r.classification !== 'book').length;
    return estimateGameRating(i.analysis.acpl[c], played, i.row.myRating);
  });
  const blunders = all.filter((x) => x.classification === 'blunder').length;
  return {
    games: items.length,
    avgAccuracy: accuracy.reduce((s, a) => s + a.value, 0) / n,
    avgGameRating: Math.round(gameRatings.reduce((s, r) => s + r, 0) / n / 10) * 10,
    errorsPerGame: all.length / n,
    blundersPerGame: blunders / n,
    accuracy: accuracy.sort((a, b) => +a.date - +b.date),
    byCause: by((x) => x.tactic, CAUSE_LABEL),
    byTime: by((x) => x.timeCause, TIME_LABEL),
    byPhase: by((x) => x.phase, { opening: 'Opening', middlegame: 'Middlegame', endgame: 'Endgame' }),
    decidingReasons: [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]),
  };
}

export interface Recommendation {
  title: string;
  why: string;
  href: string;
  action: string;
}

/** Turns the numbers into the 3–4 things that would gain you the most rating points. */
export function recommendations(agg: ReturnType<typeof aggregate> | null, rows: GameRow[], openings: OpeningStat[]): Recommendation[] {
  const out: (Recommendation & { weight: number })[] = [];
  const losses = rows.filter((r) => r.outcome === 'loss');
  const timeouts = losses.filter((r) => r.endReason === 'lost on time').length;
  if (agg && agg.games) {
    const cause = (k: string) => agg.byCause.find((c) => c.key === k)?.count ?? 0;
    const time = (k: string) => agg.byTime.find((c) => c.key === k)?.count ?? 0;
    const per = (x: number) => (x / agg.games).toFixed(1);
    if (cause('hung-piece'))
      out.push({ weight: cause('hung-piece') * 4, title: 'Stop hanging pieces', why: `You left material undefended ${per(cause('hung-piece'))} times per game.`, href: '#/train/theme/hangingPiece', action: 'Hanging-piece puzzles' });
    if (cause('allowed-tactic') + cause('allowed-mate'))
      out.push({ weight: (cause('allowed-tactic') + cause('allowed-mate')) * 3, title: 'See your opponent’s tactics first', why: `${cause('allowed-tactic') + cause('allowed-mate')} of your mistakes allowed a fork, pin or mating attack.`, href: '#/train/theme/fork', action: 'Fork puzzles' });
    if (cause('missed-win') + cause('missed-mate'))
      out.push({ weight: (cause('missed-win') + cause('missed-mate')) * 3, title: 'Cash in your chances', why: `You missed ${cause('missed-win') + cause('missed-mate')} winning moves.`, href: '#/train/theme/mateIn2', action: 'Mate-in-2 puzzles' });
    if (time('premove') + time('rushed'))
      out.push({ weight: (time('premove') + time('rushed')) * 3, title: 'Slow down at critical moments', why: `${time('premove') + time('rushed')} mistakes were premoves or rushed moves.`, href: '#/learn/blunder-check', action: 'Blunder-check lesson' });
    if (time('time-trouble'))
      out.push({ weight: time('time-trouble') * 3, title: 'Manage your clock', why: `${time('time-trouble')} mistakes came in time trouble.`, href: '#/learn/time', action: 'Time-management lesson' });
    const endgame = agg.byPhase.find((p) => p.key === 'endgame')?.count ?? 0;
    if (endgame >= 2)
      out.push({ weight: endgame * 2, title: 'Practise endgames', why: `${endgame} mistakes happened in the endgame.`, href: '#/practice/drills', action: 'Endgame drills' });
  }
  if (losses.length >= 5 && timeouts / losses.length >= 0.25)
    out.push({ weight: timeouts * 2, title: 'You lose too many games on time', why: `${timeouts} of your ${losses.length} losses were on time.`, href: '#/learn/time', action: 'Time-management lesson' });
  const worst = openings.filter((o) => o.n >= 4).sort((a, b) => a.score - b.score)[0];
  if (worst && worst.score < 45)
    out.push({ weight: worst.n, title: `Fix your ${worst.family} as ${worst.color === 'w' ? 'White' : 'Black'}`, why: `You score ${worst.score}% in ${worst.n} games with it.`, href: '#/openings', action: 'Openings' });
  return out.sort((a, b) => b.weight - a.weight).slice(0, 4);
}
