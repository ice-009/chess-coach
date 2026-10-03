// Client for the local master-games database API (server/dbApi.ts).

export interface DbGame {
  id: number;
  white: string;
  black: string;
  white_key: string;
  black_key: string;
  white_elo: number;
  black_elo: number;
  white_title: string;
  black_title: string;
  result: 1 | 0 | -1;
  date: string;
  year: number;
  event: string;
  site: string;
  round: string;
  eco: string;
  opening: string;
  plies: number;
  online: number; // 1 = internet game
  speed: 'classical' | 'rapid' | 'blitz';
  ply?: number; // where the explored position occurs in this game
  moves?: string;
  source?: string;
}

export interface ExploreMove {
  move: string;
  n: number;
  w: number;
  d: number;
  b: number;
  elo: number | null;
  last: number;
}

export interface ExploreResult {
  opening: { eco: string; name: string } | null;
  total: number;
  endedHere: number;
  moves: ExploreMove[];
  topGames: DbGame[];
}

export interface DbPlayer {
  key: string;
  name: string;
  title: string;
  max_elo: number;
  games: number;
  otb_games: number;
  first_year: number;
  last_year: number;
}

export interface Score {
  n: number;
  w: number;
  d: number;
  l: number;
}

export interface Dossier {
  player: DbPlayer;
  asWhite: Score;
  asBlack: Score;
  whiteRep: (Score & { fam: string; eco: string })[];
  blackRep: (Score & { fam: string; eco: string })[];
  ratings: { year: number; elo: number }[];
  bestWins: DbGame[];
  recent: DbGame[];
}

export interface DbStatus {
  ready: boolean;
  meta: Record<string, string> | null;
  build: { state: string; step: string; progress: number; running: boolean; error?: string; games?: number };
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || `Database error (${res.status})`);
  return res.json() as Promise<T>;
}

export const fetchStatus = () => fetch('/api/db/status').then((r) => json<DbStatus>(r));

export function startBuild(issues: number) {
  return fetch('/api/db/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ issues }) }).then((r) => json<{ started: boolean }>(r));
}

const exploreCache = new Map<string, ExploreResult>();
export async function explore(fens: string[], minElo: number, online: boolean, signal?: AbortSignal): Promise<ExploreResult> {
  const key = `${minElo}|${online}|${fens.join(';')}`;
  const hit = exploreCache.get(key);
  if (hit) return hit;
  const res = await fetch('/api/db/explore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fens, minElo, online }), signal });
  const data = await json<ExploreResult>(res);
  if (exploreCache.size > 500) exploreCache.clear();
  exploreCache.set(key, data);
  return data;
}

export const searchGames = (params: Record<string, string | number>) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v !== 0).map(([k, v]) => [k, String(v)]));
  return fetch(`/api/db/games?${q}`).then((r) => json<{ games: DbGame[]; total: number; capped: boolean; page: number }>(r));
};
export const getGame = (id: number) => fetch(`/api/db/game?id=${id}`).then((r) => json<DbGame>(r));
export const searchPlayers = (q: string, signal?: AbortSignal) => fetch(`/api/db/players?q=${encodeURIComponent(q)}`, { signal }).then((r) => json<DbPlayer[]>(r));
export const getPlayer = (key: string, online: boolean) => fetch(`/api/db/player?key=${encodeURIComponent(key)}${online ? '&online=1' : ''}`).then((r) => json<Dossier>(r));

export const resultText = (r: number) => (r === 1 ? '1-0' : r === -1 ? '0-1' : '½-½');
