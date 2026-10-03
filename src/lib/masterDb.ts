// Client for the master-games database: the Mac's local server (server/dbApi.ts), or on the hosted site the
// copy stored on this device (src/lib/localDb.ts). Both run the same queries (src/lib/dbQueries.ts).
import { STATIC_HOST } from './host';
import { localQuery, localStatus } from './localDb';

/** The hosted site has no server, so its database (if any) lives on this device. */
export const ON_DEVICE = STATIC_HOST;

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

const IDLE = { state: 'idle', step: '', progress: 0, running: false };
export const fetchStatus = (): Promise<DbStatus> =>
  ON_DEVICE ? localStatus().then((st) => ({ ready: st.ready, meta: st.meta, build: IDLE })) : fetch('/api/db/status').then((r) => json<DbStatus>(r));

/** One read-only API route, answered by the server or by the on-device database. */
async function api<T>(route: string, params: Record<string, string | number> = {}, body?: unknown, signal?: AbortSignal): Promise<T> {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v !== 0).map(([k, v]) => [k, String(v)])).toString();
  if (ON_DEVICE) {
    const [status, data] = await localQuery(route, q, body);
    if (status !== 200) throw new Error((data as { error?: string }).error || `Database error (${status})`);
    return data as T;
  }
  const init: RequestInit = body === undefined ? { signal } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal };
  return json<T>(await fetch(`/api/db/${route}${q ? `?${q}` : ''}`, init));
}

export function startBuild(issues: number) {
  return fetch('/api/db/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ issues }) }).then((r) => json<{ started: boolean }>(r));
}

const exploreCache = new Map<string, ExploreResult>();
export async function explore(fens: string[], minElo: number, online: boolean, signal?: AbortSignal): Promise<ExploreResult> {
  const key = `${minElo}|${online}|${fens.join(';')}`;
  const hit = exploreCache.get(key);
  if (hit) return hit;
  const data = await api<ExploreResult>('explore', {}, { fens, minElo, online }, signal);
  if (exploreCache.size > 500) exploreCache.clear();
  exploreCache.set(key, data);
  return data;
}

export const searchGames = (params: Record<string, string | number>) => api<{ games: DbGame[]; total: number; capped: boolean; page: number }>('games', params);
export const getGame = (id: number) => api<DbGame>('game', { id });
export const searchPlayers = (q: string, signal?: AbortSignal) => api<DbPlayer[]>('players', { q }, undefined, signal);
export const topPlayers = () => api<DbPlayer[]>('players', { top: 1 });
export const getPlayer = (key: string, online: boolean) => api<Dossier>('player', { key, online: online ? 1 : 0 });

export const resultText = (r: number) => (r === 1 ? '1-0' : r === -1 ? '0-1' : '½-½');
