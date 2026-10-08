// Puzzle trainer state: the puzzle API, your puzzle rating, and spaced-repetition review of misses.
import { KEYS, load, save } from './storage';
import { AGAIN, GOOD, addCard, dueCards, gradeCard, loadDeck } from './deck';
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
  themeIndex?: string[]; // rare themes with their own index file, t/<theme>.json: [id, band, rating][]
}
let manifest: Promise<Manifest> | null = null;
const staticManifest = () => (manifest ??= fetch('/puzzles/manifest.json').then((r) => r.json() as Promise<Manifest>));
const bandCache = new Map<number, Promise<Row[]>>();
const loadBand = (b: number) => {
  if (!bandCache.has(b)) bandCache.set(b, fetch(`/puzzles/b${b}.json`).then((r) => (r.ok ? (r.json() as Promise<Row[]>) : [])));
  return bandCache.get(b)!;
};
const fromRow = (r: Row): Puzzle => ({ id: r[0], fen: r[1], moves: r[2].split(' '), rating: r[3], themes: r[4].split(' '), opening: '', gameUrl: `https://lichess.org/${r[5]}` });

type ThemeEntry = [string, number, number]; // id, band, rating
const themeCache = new Map<string, Promise<ThemeEntry[]>>();

/** Rare themes (e.g. Boden's mate, knight endgames) are looked up in their own index instead of scanning every band. */
async function staticThemePuzzle(rating: number, theme: string, seen: Set<string>): Promise<Puzzle> {
  if (!themeCache.has(theme)) themeCache.set(theme, fetch(`/puzzles/t/${theme}.json`).then((r) => r.json() as Promise<ThemeEntry[]>));
  const all = (await themeCache.get(theme)!).filter((e) => !seen.has(e[0]));
  if (!all.length) throw new Error('No puzzle found');
  for (const range of [100, 200, 400, 800, 4000]) {
    const near = all.filter((e) => Math.abs(e[2] - rating) <= range);
    if (near.length) {
      const [id, band] = near[Math.floor(Math.random() * near.length)];
      const row = (await loadBand(band)).find((r) => r[0] === id);
      if (row) return fromRow(row);
    }
  }
  throw new Error('No puzzle found');
}

async function staticPuzzle(rating: number, theme: string | undefined, seen: Set<string>): Promise<Puzzle> {
  const { bands, themeIndex } = await staticManifest();
  if (theme && themeIndex?.includes(theme)) return staticThemePuzzle(rating, theme, seen);
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

// ── Spaced repetition: a puzzle you miss goes into your review deck (src/lib/deck.ts, scheduled by FSRS) ──
export function scheduleReview(id: string, solved: boolean, fromReview: boolean) {
  if (fromReview) {
    if (!gradeCard(`puzzle:${id}`, solved ? GOOD : AGAIN) && !solved) addCard({ kind: 'puzzle', ref: id, title: 'A puzzle you missed' }, AGAIN);
    return;
  }
  if (!solved) addCard({ kind: 'puzzle', ref: id, title: 'A puzzle you missed' }, AGAIN);
}

/** Puzzle cards due now (the deck also holds other kinds: see dueCards). */
export const dueReviews = (now = Date.now()): string[] => dueCards(now).filter((c) => c.kind === 'puzzle').map((c) => c.ref);
export const reviewCount = () => Object.values(loadDeck()).filter((c) => c.kind === 'puzzle').length;

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

/** Endgame puzzles, with the lesson that explains each type. */
export const ENDGAME_THEMES: { key: string; label: string; tip: string; lesson?: string }[] = [
  { key: 'endgame', label: 'All endgames', tip: 'Few pieces left: activate the king, push passed pawns, calculate to the end.' },
  { key: 'pawnEndgame', label: 'Pawn endgames', tip: 'Kings and pawns only: opposition, key squares, breakthroughs, outside passed pawns.', lesson: 'kp-endgames' },
  { key: 'rookEndgame', label: 'Rook endgames', tip: 'The most common endgame: active rook, cut off the king, rooks behind passed pawns.', lesson: 'rook-endgames' },
  { key: 'bishopEndgame', label: 'Bishop endgames', tip: 'Good and bad bishops, the wrong rook pawn, opposite-coloured bishops.', lesson: 'minor-endgames' },
  { key: 'knightEndgame', label: 'Knight endgames', tip: 'Knights are slow: count the jumps, and watch for forks.', lesson: 'minor-endgames' },
  { key: 'queenEndgame', label: 'Queen endgames', tip: 'Checks everywhere: shelter your king and push your pawn with the queen’s help.', lesson: 'queen-endgames' },
  { key: 'queenRookEndgame', label: 'Queen and rook', tip: 'Heavy pieces: mating attacks and back ranks still matter.' },
  { key: 'zugzwang', label: 'Zugzwang', tip: 'Every move makes it worse: find the move that leaves your opponent with only bad ones.', lesson: 'pawn-endgame-technique' },
  { key: 'promotion', label: 'Promotion', tip: 'Push the pawn home, and clear the way first.' },
  { key: 'underPromotion', label: 'Underpromotion', tip: 'Sometimes a knight (or rook) is better than a queen: check for stalemate and forks.' },
];

/** Checkmate puzzles: the classic mating patterns, named after the pieces that give them. */
export const MATE_THEMES: { key: string; label: string; tip: string; lesson?: string }[] = [
  { key: 'mate', label: 'All checkmates', tip: 'Every puzzle ends in checkmate.', lesson: 'mating-patterns' },
  { key: 'mateIn1', label: 'Mate in 1', tip: 'Find the checkmate.' },
  { key: 'mateIn2', label: 'Mate in 2', tip: 'Check, then mate.' },
  { key: 'mateIn3', label: 'Mate in 3', tip: 'A longer forcing line.' },
  { key: 'backRankMate', label: 'Back-rank mate', tip: 'Rook or queen on the back rank; the king is trapped behind its own pawns.', lesson: 'mating-patterns' },
  { key: 'smotheredMate', label: 'Smothered mate (knight)', tip: 'A knight mates a king boxed in by its own pieces.' },
  { key: 'arabianMate', label: 'Arabian mate (rook + knight)', tip: 'Rook next to the cornered king, knight guarding the rook and the escape square.' },
  { key: 'anastasiaMate', label: 'Anastasia’s mate (knight + rook)', tip: 'A knight takes away the escape squares, a rook or queen mates on the edge file.' },
  { key: 'hookMate', label: 'Hook mate (rook + knight + pawn)', tip: 'Rook protected by a knight, knight protected by a pawn.' },
  { key: 'bodenMate', label: 'Boden’s mate (two bishops)', tip: 'Two bishops on crossing diagonals mate a king blocked by its own pieces.' },
  { key: 'doubleBishopMate', label: 'Two-bishop mate', tip: 'Two bishops side by side cover the king and its escape squares.' },
  { key: 'blindSwineMate', label: 'Two rooks on the 7th', tip: '“Blind swine”: doubled rooks on the 7th rank sweep the king’s shelter.' },
  { key: 'epauletteMate', label: 'Epaulette mate (queen)', tip: 'The king’s own rooks (or pieces) on both sides block it in.' },
  { key: 'dovetailMate', label: 'Dovetail mate (queen)', tip: 'The queen mates diagonally next to the king; its own pieces block the escape.' },
  { key: 'cornerMate', label: 'Corner mate', tip: 'A king in the corner, mated by a rook and a knight or minor piece.' },
  { key: 'killBoxMate', label: 'Kill box (rook + queen)', tip: 'Rook mates along a file or rank, protected by the queen next to it.' },
  { key: 'swallowstailMate', label: 'Swallow’s tail (queen)', tip: 'The queen mates head-on; the king’s own pieces block the side squares.' },
  { key: 'triangleMate', label: 'Triangle mate', tip: 'Queen and rook form a triangle around the king.' },
  { key: 'vukovicMate', label: 'Vuković mate (rook + knight)', tip: 'Rook mates on the edge, protected by the king or a pawn, knight covering escapes.' },
];
const ALL_THEMES: { key: string; label: string; tip: string; lesson?: string }[] = [...THEMES, ...ENDGAME_THEMES, ...MATE_THEMES];
export const themeInfo = (key: string) => ALL_THEMES.find((t) => t.key === key);
export const themeLabel = (key: string) => ALL_THEMES.find((t) => t.key === key)?.label ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
