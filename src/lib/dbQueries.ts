// The master database's read queries, shared by the Mac's local server (node:sqlite, server/dbApi.ts) and the
// on-device database in the browser (SQLite compiled to WebAssembly, src/lib/localDb.worker.ts).
import { normalizeFen, positionKey } from './positionKey.ts';

type Param = string | number;
type Row = Record<string, unknown>;

/** The two calls the queries need, so any SQLite binding can run them. */
export interface SqlDb {
  all(sql: string, params?: Param[]): Row[];
  get(sql: string, params?: Param[]): Row | undefined;
}

/** Optional tables: databases built by older versions of the build script lack them. */
export interface DbInfo {
  exploreCache: boolean;
  openingsTable: boolean;
}

export const dbInfo = (d: SqlDb): DbInfo => ({
  exploreCache: !!d.get("SELECT 1 FROM sqlite_master WHERE name = 'explore_cache'"),
  openingsTable: !!d.get("SELECT 1 FROM sqlite_master WHERE name = 'openings'"),
});

const GAME_COLUMNS = 'g.id, g.white, g.black, g.white_key, g.black_key, g.white_elo, g.black_elo, g.white_title, g.black_title, g.result, g.date, g.year, g.event, g.site, g.round, g.eco, g.opening, g.plies, g.online, g.speed';
const PLAYER_COLUMNS = 'key, name, title, max_elo, games, otb_games, first_year, last_year';
const family = (col: string) => `CASE WHEN instr(${col}, ':') > 0 THEN substr(${col}, 1, instr(${col}, ':') - 1) ELSE ${col} END`;
const int = (v: string | null, fallback: number) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : fallback);

export const meta = (d: SqlDb): Record<string, string> => Object.fromEntries(d.all('SELECT key, value FROM meta').map((r) => [r.key, r.value]));

type OpeningName = { eco: string; name: string };

/** Explorer: master moves, statistics and top games for a position. */
export function explore(d: SqlDb, info: DbInfo, body: { fens?: string[]; minElo?: number; online?: boolean }, fallbackName?: (key: number) => OpeningName | undefined) {
  const fens = (body.fens ?? []).slice(-120).map(normalizeFen).filter((f): f is string => !!f);
  if (!fens.length) return { error: 'bad position' };
  const key = positionKey(fens[fens.length - 1]);
  const minElo = Math.max(0, Number(body.minElo) || 0);
  const maxOnline = body.online ? 1 : 0; // positions are keyed (hash, online, avg_elo, …)

  // the deepest named position along the line gives the opening name
  let opening: OpeningName | null = null;
  for (const f of fens) {
    const k = positionKey(f);
    opening = (info.openingsTable ? (d.get('SELECT eco, name FROM openings WHERE hash = ?', [k]) as OpeningName | undefined) : fallbackName?.(k)) ?? opening;
  }

  type MoveRow = { move: string | null; n: number; w: number; d: number; b: number; elo: number | null; last: number };
  // the most popular positions are precomputed at build time (same query, same filters)
  const cached =
    info.exploreCache && [0, 2200, 2400, 2600].includes(minElo)
      ? (d.get('SELECT moves, top FROM explore_cache WHERE hash = ? AND online = ? AND min_elo = ?', [key, maxOnline, minElo]) as { moves: string; top: string } | undefined)
      : undefined;
  const rows: MoveRow[] = cached
    ? JSON.parse(cached.moves)
    : (d.all(
        `SELECT move, COUNT(*) n, SUM(result = 1) w, SUM(result = 0) d, SUM(result = -1) b,
                CAST(AVG(NULLIF(avg_elo, 0)) AS INTEGER) elo, MAX(year) last
         FROM positions WHERE hash = ? AND online <= ? AND avg_elo >= ? GROUP BY move ORDER BY n DESC`,
        [key, maxOnline, minElo],
      ) as MoveRow[]);
  const total = rows.reduce((s, r) => s + r.n, 0);
  const ended = rows.find((r) => r.move === null);
  const top = (
    cached
      ? (JSON.parse(cached.top) as { game_id: number; ply: number }[]).map((t) => ({ ...d.get(`SELECT ${GAME_COLUMNS} FROM games g WHERE g.id = ?`, [t.game_id]), ply: t.ply }))
      : d.all(
          `SELECT ${GAME_COLUMNS}, p.ply FROM positions p JOIN games g ON g.id = p.game_id
           WHERE p.hash = ? AND p.online <= ? AND p.avg_elo >= ? ORDER BY p.avg_elo DESC LIMIT 24`,
          [key, maxOnline, minElo],
        )
  ) as { id: number }[];
  const seen = new Set<number>();
  return {
    opening,
    total,
    endedHere: ended?.n ?? 0,
    moves: rows.filter((r) => r.move !== null),
    topGames: top.filter((g) => !seen.has(g.id) && seen.add(g.id)).slice(0, 12),
  };
}

/** Game search with filters. */
export function searchGames(d: SqlDb, q: URLSearchParams) {
  const where: string[] = [];
  const args: Param[] = [];
  const add = (sql: string, ...values: Param[]) => {
    where.push(sql);
    args.push(...values);
  };
  const player = q.get('player');
  const color = q.get('color');
  if (player) {
    if (color === 'white') add('g.white_key = ?', player);
    else if (color === 'black') add('g.black_key = ?', player);
    else add('(g.white_key = ? OR g.black_key = ?)', player, player);
  }
  const opponent = q.get('opponent');
  if (opponent) add('(g.white_key = ? OR g.black_key = ?)', opponent, opponent);
  const eco = q.get('eco')?.toUpperCase().trim();
  if (eco) add('g.eco LIKE ?', `${eco}%`);
  const opening = q.get('opening')?.trim();
  if (opening) add('g.opening LIKE ?', `%${opening}%`);
  const event = q.get('event')?.trim();
  if (event) add('g.event LIKE ?', `%${event}%`);
  const result = q.get('result'); // '1-0' | '0-1' | 'draw' | 'win' | 'loss' (win/loss relative to the player)
  if (result === '1-0') add('g.result = 1');
  if (result === '0-1') add('g.result = -1');
  if (result === 'draw') add('g.result = 0');
  if (player && (result === 'win' || result === 'loss')) {
    const sign = result === 'win' ? 1 : -1;
    add(`((g.white_key = ? AND g.result = ${sign}) OR (g.black_key = ? AND g.result = ${-sign}))`, player, player);
  }
  const from = int(q.get('from'), 0);
  const to = int(q.get('to'), 0);
  if (from) add('g.year >= ?', from);
  if (to) add('g.year <= ?', to);
  const minElo = int(q.get('minElo'), 0);
  if (minElo) add('g.white_elo >= ? AND g.black_elo >= ?', minElo, minElo);
  if (q.get('online') !== '1') add('g.online = 0');
  const speed = q.get('speed');
  if (speed === 'classical' || speed === 'rapid' || speed === 'blitz') add('g.speed = ?', speed);

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const order = q.get('sort') === 'elo' ? '(g.white_elo + g.black_elo) DESC' : 'g.date DESC, g.id DESC';
  const page = Math.max(0, int(q.get('page'), 0));
  const games = d.all(`SELECT ${GAME_COLUMNS} FROM games g ${clause} ORDER BY ${order} LIMIT 50 OFFSET ?`, [...args, page * 50]);
  const count = d.get(`SELECT COUNT(*) n FROM (SELECT 1 FROM games g ${clause} LIMIT 10001)`, args) as { n: number };
  return { games, total: count.n, capped: count.n > 10000, page };
}

/** Player dossier: results, repertoire and rating history. */
export function dossier(d: SqlDb, key: string, online: boolean) {
  const otb = online ? '' : ' AND online = 0';
  const player = d.get(`SELECT ${PLAYER_COLUMNS} FROM players WHERE key = ?`, [key]);
  if (!player) return null;
  const score = (col: 'white_key' | 'black_key', sign: number) =>
    d.get(`SELECT COUNT(*) n, SUM(result = ${sign}) w, SUM(result = 0) d, SUM(result = ${-sign}) l FROM games WHERE ${col} = ?${otb}`, [key]);
  const repertoire = (col: 'white_key' | 'black_key', sign: number) =>
    d.all(
      `SELECT ${family('opening')} fam, MIN(eco) eco, COUNT(*) n, SUM(result = ${sign}) w, SUM(result = 0) d, SUM(result = ${-sign}) l
       FROM games WHERE ${col} = ? AND opening <> ''${otb} GROUP BY fam ORDER BY n DESC LIMIT 12`,
      [key],
    );
  const ratings = d.all(
    `SELECT year, MAX(elo) elo FROM (SELECT year, white_elo elo FROM games WHERE white_key = ? AND online = 0 UNION ALL SELECT year, black_elo FROM games WHERE black_key = ? AND online = 0)
     WHERE elo > 0 AND year > 0 GROUP BY year ORDER BY year`,
    [key, key],
  );
  const gOnline = otb.replace('online', 'g.online');
  const bestWins = d.all(
    `SELECT ${GAME_COLUMNS} FROM games g WHERE ((g.white_key = ? AND g.result = 1) OR (g.black_key = ? AND g.result = -1))${gOnline}
     ORDER BY g.speed = 'classical' DESC, CASE WHEN g.white_key = ? THEN g.black_elo ELSE g.white_elo END DESC LIMIT 8`,
    [key, key, key],
  );
  const recent = d.all(`SELECT ${GAME_COLUMNS} FROM games g WHERE (g.white_key = ? OR g.black_key = ?)${gOnline} ORDER BY g.date DESC LIMIT 15`, [key, key]);
  return { player, asWhite: score('white_key', 1), asBlack: score('black_key', -1), whiteRep: repertoire('white_key', 1), blackRep: repertoire('black_key', -1), ratings, bestWins, recent };
}

/**
 * The read-only API routes (explore, games, game, players, player) as [HTTP status, body].
 * `body` is the parsed JSON body for POST routes.
 */
export function query(d: SqlDb, info: DbInfo, route: string, params: URLSearchParams, body?: unknown, fallbackName?: (key: number) => OpeningName | undefined): [number, unknown] {
  switch (route) {
    case 'explore':
      return [200, explore(d, info, (body ?? {}) as Parameters<typeof explore>[2], fallbackName)];
    case 'games':
      return [200, searchGames(d, params)];
    case 'game': {
      const game = d.get(`SELECT ${GAME_COLUMNS}, g.moves, g.source FROM games g WHERE g.id = ?`, [int(params.get('id'), 0)]);
      return game ? [200, game] : [404, { error: 'Game not found' }];
    }
    case 'players': {
      if (params.get('top')) return [200, d.all(`SELECT ${PLAYER_COLUMNS} FROM players WHERE otb_games >= 20 ORDER BY max_elo DESC LIMIT 40`)];
      const q = (params.get('q') ?? '').toLowerCase().trim();
      if (q.length < 2) return [200, []];
      return [200, d.all(`SELECT ${PLAYER_COLUMNS} FROM players WHERE name_lc LIKE ? ORDER BY games DESC LIMIT 12`, [`%${q.replace(/[%_]/g, '')}%`])];
    }
    case 'player': {
      const data = dossier(d, params.get('key') ?? '', params.get('online') === '1');
      return data ? [200, data] : [404, { error: 'Player not found' }];
    }
    default:
      return [404, { error: 'Unknown endpoint' }];
  }
}
