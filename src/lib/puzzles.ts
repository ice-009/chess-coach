// Puzzle trainer state: the puzzle API, your puzzle rating, and spaced-repetition review of misses.
import { KEYS, load, save } from './storage';
import { STATIC_HOST } from './host';

export interface Puzzle {
  id: string;
  fen: string;
  moves: string[]; // UCI; the first is the opponent's move that sets up the puzzle
  rating: number;
  themes: string[];
  opening: string;
  gameUrl: string;
}

interface RawPuzzle {
  id: string;
  fen: string;
  moves: string;
  rating: number;
  themes: string;
  opening: string;
  game_url: string;
}

const parse = (r: RawPuzzle): Puzzle => ({ id: r.id, fen: r.fen, moves: r.moves.split(' '), rating: r.rating, themes: r.themes.split(' ').filter(Boolean), opening: r.opening, gameUrl: r.game_url });

export interface PuzzleStatus {
  ready: boolean;
  count: number;
  build: { state: string; step: string; progress: number; running: boolean; error?: string };
}
export const puzzleStatus = (): Promise<PuzzleStatus> =>
  STATIC_HOST
    ? staticManifest().then((m) => ({ ready: true, count: m.count, build: { state: 'done', step: '', progress: 1, running: false } }))
    : fetch('/api/puzzles/status').then((r) => r.json() as Promise<PuzzleStatus>);

// ── Hosted build: puzzles are static files, one per 50-point rating band (see scripts/puzzles/export-static.ts) ──
type Row = [string, string, string, number, string, string]; // id, fen, moves, rating, themes, game
interface Manifest {
  count: number;
  bands: Record<string, number>;
}
let manifest: Promise<Manifest> | null = null;
const staticManifest = () => (manifest ??= fetch('/puzzles/manifest.json').then((r) => r.json() as Promise<Manifest>));
const bandCache = new Map<number, Promise<Row[]>>();
const loadBand = (b: number) => {
  if (!bandCache.has(b)) bandCache.set(b, fetch(`/puzzles/b${b}.json`).then((r) => (r.ok ? (r.json() as Promise<Row[]>) : [])));
  return bandCache.get(b)!;
};
const fromRow = (r: Row): Puzzle => ({ id: r[0], fen: r[1], moves: r[2].split(' '), rating: r[3], themes: r[4].split(' '), opening: '', gameUrl: `https://lichess.org/${r[5]}` });

async function staticPuzzle(rating: number, theme: string | undefined, seen: Set<string>): Promise<Puzzle> {
  const { bands } = await staticManifest();
  const center = Math.floor(rating / 50);
  for (let spread = 0; spread <= 40; spread++) {
    for (const b of spread ? [center - spread, center + spread] : [center]) {
      if (!bands[b]) continue;
      const rows = (await loadBand(b)).filter((r) => !seen.has(r[0]) && (!theme || r[4].split(' ').includes(theme)));
      if (rows.length) return fromRow(rows[Math.floor(Math.random() * rows.length)]);
    }
  }
  throw new Error('No puzzle found');
}
export const buildPuzzles = () => fetch('/api/puzzles/build', { method: 'POST' }).then((r) => r.json());

export async function fetchPuzzle(rating: number, theme?: string): Promise<Puzzle> {
  const seen = load<string[]>(KEYS.puzzleSeen, []);
  if (STATIC_HOST) return staticPuzzle(rating, theme, new Set(seen.slice(-250)));
  const q = new URLSearchParams({ rating: String(Math.round(rating)), exclude: seen.slice(-250).join(',') });
  if (theme) q.set('theme', theme);
  const res = await fetch(`/api/puzzles/next?${q}`);
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || 'Could not load a puzzle');
  return parse((await res.json()) as RawPuzzle);
}

export async function fetchPuzzleById(id: string): Promise<Puzzle> {
  if (STATIC_HOST) {
    const idx = (await fetch(`/puzzles/idx/${id.charCodeAt(0)}.json`).then((r) => r.json())) as Record<string, number>;
    const row = idx[id] !== undefined ? (await loadBand(idx[id])).find((r) => r[0] === id) : undefined;
    if (!row) throw new Error('Puzzle not found');
    return fromRow(row);
  }
  const res = await fetch(`/api/puzzles/get?id=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Puzzle not found');
  return parse((await res.json()) as RawPuzzle);
}

export function markSeen(id: string) {
  const seen = load<string[]>(KEYS.puzzleSeen, []);
  save(KEYS.puzzleSeen, [...seen.filter((s) => s !== id), id].slice(-500));
}

// ── Your puzzle rating (Elo-style; moves fast at first, then settles) ──
export interface PuzzleRating {
  rating: number;
  games: number;
  history: { t: number; r: number }[];
}
export const START_RATING = 1000;
export const getRating = (): PuzzleRating => load(KEYS.puzzleRating, { rating: START_RATING, games: 0, history: [] });

export function updateRating(puzzleRating: number, solved: boolean): { before: number; after: number } {
  const s = getRating();
  const k = s.games < 20 ? 60 : s.games < 60 ? 32 : 20;
  const expected = 1 / (1 + 10 ** ((puzzleRating - s.rating) / 400));
  const after = Math.max(400, Math.round(s.rating + k * ((solved ? 1 : 0) - expected)));
  save(KEYS.puzzleRating, { rating: after, games: s.games + 1, history: [...s.history, { t: Date.now(), r: after }].slice(-400) });
  return { before: s.rating, after };
}

// ── Spaced repetition: a missed puzzle comes back after 1, 3, 7 and 21 days until solved cleanly ──
const INTERVALS = [1, 3, 7, 21];
type ReviewItem = { box: number; due: number };

export function scheduleReview(id: string, solved: boolean, fromReview: boolean) {
  const all = load<Record<string, ReviewItem>>(KEYS.puzzleReview, {});
  const cur = all[id];
  if (!solved) all[id] = { box: 0, due: Date.now() + INTERVALS[0] * 86400_000 };
  else if (cur && fromReview) {
    const box = cur.box + 1;
    if (box >= INTERVALS.length) delete all[id]; // learned
    else all[id] = { box, due: Date.now() + INTERVALS[box] * 86400_000 };
  }
  save(KEYS.puzzleReview, all);
}

export function dueReviews(now = Date.now()): string[] {
  const all = load<Record<string, ReviewItem>>(KEYS.puzzleReview, {});
  return Object.entries(all)
    .filter(([, v]) => v.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}
export const reviewCount = () => Object.keys(load<Record<string, ReviewItem>>(KEYS.puzzleReview, {})).length;

// ── Themes: friendly names, with the ones that matter most below 1500 first ──
export const THEMES: { key: string; label: string; tip: string }[] = [
  { key: 'hangingPiece', label: 'Hanging pieces', tip: 'Something is undefended. Take it, or save yours.' },
  { key: 'fork', label: 'Forks', tip: 'One move, two targets.' },
  { key: 'pin', label: 'Pins', tip: 'A piece cannot move without exposing something bigger.' },
  { key: 'skewer', label: 'Skewers', tip: 'Attack the big piece; win the one behind it.' },
  { key: 'mateIn1', label: 'Mate in 1', tip: 'Find the checkmate.' },
  { key: 'mateIn2', label: 'Mate in 2', tip: 'Check, then mate.' },
  { key: 'backRankMate', label: 'Back-rank mate', tip: 'The king is trapped behind its own pawns.' },
  { key: 'discoveredAttack', label: 'Discovered attacks', tip: 'Move one piece to unleash another.' },
  { key: 'doubleCheck', label: 'Double check', tip: 'Two checks at once: the king must move.' },
  { key: 'trappedPiece', label: 'Trapped pieces', tip: 'A piece with no safe squares.' },
  { key: 'capturingDefender', label: 'Remove the defender', tip: 'Take the piece that guards the target.' },
  { key: 'defensiveMove', label: 'Defence', tip: 'Find the move that saves you.' },
  { key: 'mateIn3', label: 'Mate in 3', tip: 'A longer forcing line.' },
  { key: 'sacrifice', label: 'Sacrifices', tip: 'Give material to win more.' },
  { key: 'deflection', label: 'Deflection', tip: 'Lure a defender away.' },
  { key: 'attraction', label: 'Attraction', tip: 'Drag a piece onto a bad square.' },
  { key: 'promotion', label: 'Promotion', tip: 'Push the pawn home.' },
  { key: 'pawnEndgame', label: 'Pawn endgames', tip: 'King activity and opposition.' },
  { key: 'rookEndgame', label: 'Rook endgames', tip: 'The most common endgame.' },
  { key: 'opening', label: 'Opening traps', tip: 'Punish early mistakes.' },
];
export const themeLabel = (key: string) => THEMES.find((t) => t.key === key)?.label ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
