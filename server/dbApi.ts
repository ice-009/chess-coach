// Local API over data/masters.db (built by scripts/db). Runs inside the Vite dev/preview server.
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import type { Connect, Plugin } from 'vite';
import type { ServerResponse } from 'node:http';
import { DATA_DIR, DB_PATH, ROOT, STATUS_PATH, loadOpenings, normalizeFen, positionKey } from '../scripts/db/common.ts';
import type { BuildStatus } from '../scripts/db/common.ts';

let db: DatabaseSync | null = null;
let dbMtime = 0;
let openings: Map<number, { eco: string; name: string }> | null = null;
let hasExploreCache = false; // databases built before the cache existed don't have the table
let hasOpeningsTable = false;

/** Opens the database read-only, reopening it after a rebuild replaced the file. */
function getDb(): DatabaseSync | null {
  if (!fs.existsSync(DB_PATH)) return null;
  const mtime = fs.statSync(DB_PATH).mtimeMs;
  if (!db || mtime !== dbMtime) {
    db?.close();
    db = new DatabaseSync(DB_PATH, { readOnly: true });
    dbMtime = mtime;
    hasExploreCache = !!db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'explore_cache'").get();
    hasOpeningsTable = !!db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'openings'").get();
    openings = null;
  }
  return db;
}

function getOpenings() {
  openings ??= loadOpenings();
  return openings;
}

function readStatus(): BuildStatus {
  try {
    return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8')) as BuildStatus;
  } catch {
    return { state: 'idle', step: '', progress: 0 };
  }
}

const buildRunning = () => {
  const lock = `${DATA_DIR}/build.lock`;
  return fs.existsSync(lock) && Date.now() - fs.statSync(lock).mtimeMs < 3 * 3600_000;
};

function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readJson<T>(req: Connect.IncomingMessage): Promise<T> {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 100_000) throw new Error('too large');
  }
  return JSON.parse(body || '{}') as T;
}

const GAME_COLUMNS = 'g.id, g.white, g.black, g.white_key, g.black_key, g.white_elo, g.black_elo, g.white_title, g.black_title, g.result, g.date, g.year, g.event, g.site, g.round, g.eco, g.opening, g.plies, g.online, g.speed';
const family = (col: string) => `CASE WHEN instr(${col}, ':') > 0 THEN substr(${col}, 1, instr(${col}, ':') - 1) ELSE ${col} END`;
const int = (v: string | null, fallback: number) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : fallback);

/** Explorer: master moves, statistics and top games for a position. */
function explore(d: DatabaseSync, body: { fens?: string[]; minElo?: number; online?: boolean }) {
  const fens = (body.fens ?? []).slice(-120).map(normalizeFen).filter((f): f is string => !!f);
  if (!fens.length) return { error: 'bad position' };
  const key = positionKey(fens[fens.length - 1]);
  const minElo = Math.max(0, Number(body.minElo) || 0);
  const maxOnline = body.online ? 1 : 0; // positions are keyed (hash, online, avg_elo, …)

  // the deepest named position along the line gives the opening name
  let opening: { eco: string; name: string } | null = null;
  if (hasOpeningsTable) {
    const byHash = d.prepare('SELECT eco, name FROM openings WHERE hash = ?');
    for (const f of fens) opening = (byHash.get(positionKey(f)) as { eco: string; name: string } | undefined) ?? opening;
  } else {
    const names = getOpenings(); // older databases: fall back to parsing the opening files
    for (const f of fens) opening = names.get(positionKey(f)) ?? opening;
  }

  type MoveRow = { move: string | null; n: number; w: number; d: number; b: number; elo: number | null; last: number };
  // the most popular positions are precomputed at build time (same query, same filters)
  const cached = hasExploreCache && [0, 2200, 2400, 2600].includes(minElo)
    ? (d.prepare('SELECT moves, top FROM explore_cache WHERE hash = ? AND online = ? AND min_elo = ?').get(key, maxOnline, minElo) as { moves: string; top: string } | undefined)
    : undefined;
  const rows: MoveRow[] = cached
    ? JSON.parse(cached.moves)
    : (d
        .prepare(
          `SELECT move, COUNT(*) n, SUM(result = 1) w, SUM(result = 0) d, SUM(result = -1) b,
                  CAST(AVG(NULLIF(avg_elo, 0)) AS INTEGER) elo, MAX(year) last
           FROM positions WHERE hash = ? AND online <= ? AND avg_elo >= ? GROUP BY move ORDER BY n DESC`,
        )
        .all(key, maxOnline, minElo) as MoveRow[]);
  const total = rows.reduce((s, r) => s + r.n, 0);
  const ended = rows.find((r) => r.move === null);
  const top = (
    cached
      ? (JSON.parse(cached.top) as { game_id: number; ply: number }[]).map((t) => ({ ...(d.prepare(`SELECT ${GAME_COLUMNS} FROM games g WHERE g.id = ?`).get(t.game_id) as object), ply: t.ply }))
      : d
          .prepare(
            `SELECT ${GAME_COLUMNS}, p.ply FROM positions p JOIN games g ON g.id = p.game_id
             WHERE p.hash = ? AND p.online <= ? AND p.avg_elo >= ? ORDER BY p.avg_elo DESC LIMIT 24`,
          )
          .all(key, maxOnline, minElo)
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
function searchGames(d: DatabaseSync, q: URLSearchParams) {
  const where: string[] = [];
  const args: (string | number)[] = [];
  const add = (sql: string, ...values: (string | number)[]) => {
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
  const games = d.prepare(`SELECT ${GAME_COLUMNS} FROM games g ${clause} ORDER BY ${order} LIMIT 50 OFFSET ?`).all(...args, page * 50);
  const count = d.prepare(`SELECT COUNT(*) n FROM (SELECT 1 FROM games g ${clause} LIMIT 10001)`).get(...args) as { n: number };
  return { games, total: count.n, capped: count.n > 10000, page };
}

/** Player dossier: results, repertoire and rating history. */
function dossier(d: DatabaseSync, key: string, online: boolean) {
  const otb = online ? '' : ' AND online = 0';
  const player = d.prepare('SELECT key, name, title, max_elo, games, otb_games, first_year, last_year FROM players WHERE key = ?').get(key);
  if (!player) return null;
  const score = (col: 'white_key' | 'black_key', sign: number) =>
    d.prepare(`SELECT COUNT(*) n, SUM(result = ${sign}) w, SUM(result = 0) d, SUM(result = ${-sign}) l FROM games WHERE ${col} = ?${otb}`).get(key);
  const repertoire = (col: 'white_key' | 'black_key', sign: number) =>
    d
      .prepare(
        `SELECT ${family('opening')} fam, MIN(eco) eco, COUNT(*) n, SUM(result = ${sign}) w, SUM(result = 0) d, SUM(result = ${-sign}) l
         FROM games WHERE ${col} = ? AND opening <> ''${otb} GROUP BY fam ORDER BY n DESC LIMIT 12`,
      )
      .all(key);
  const ratings = d
    .prepare(
      `SELECT year, MAX(elo) elo FROM (SELECT year, white_elo elo FROM games WHERE white_key = ? AND online = 0 UNION ALL SELECT year, black_elo FROM games WHERE black_key = ? AND online = 0)
       WHERE elo > 0 AND year > 0 GROUP BY year ORDER BY year`,
    )
    .all(key, key);
  const bestWins = d
    .prepare(
      `SELECT ${GAME_COLUMNS} FROM games g WHERE ((g.white_key = ? AND g.result = 1) OR (g.black_key = ? AND g.result = -1))${otb.replace('online', 'g.online')}
       ORDER BY g.speed = 'classical' DESC, CASE WHEN g.white_key = ? THEN g.black_elo ELSE g.white_elo END DESC LIMIT 8`,
    )
    .all(key, key, key);
  const recent = d.prepare(`SELECT ${GAME_COLUMNS} FROM games g WHERE (g.white_key = ? OR g.black_key = ?)${otb.replace('online', 'g.online')} ORDER BY g.date DESC LIMIT 15`).all(key, key);
  return { player, asWhite: score('white_key', 1), asBlack: score('black_key', -1), whiteRep: repertoire('white_key', 1), blackRep: repertoire('black_key', -1), ratings, bestWins, recent };
}

export function dbApi(): Plugin {
  const handler: Connect.NextHandleFunction = async (req, res, next) => {
    if (!req.url?.startsWith('/api/db/')) return next();
    const url = new URL(req.url, 'http://local');
    const route = url.pathname.slice('/api/db/'.length);
    try {
      if (route === 'build' && req.method === 'POST') {
        if (buildRunning()) return send(res, 409, { error: 'A build is already running.' });
        const { issues = 52, minElo = 2000 } = await readJson<{ issues?: number; minElo?: number }>(req);
        const child = spawn(
          process.execPath,
          ['--experimental-strip-types', '--no-warnings', 'scripts/db/update.ts', '--issues', String(Math.min(1700, Math.max(1, issues))), '--min-elo', String(minElo)],
          { cwd: ROOT, detached: true, stdio: 'ignore' },
        );
        child.unref();
        return send(res, 202, { started: true });
      }
      const status = readStatus();
      const d = getDb();
      if (route === 'status') {
        const meta = d ? Object.fromEntries((d.prepare('SELECT key, value FROM meta').all() as { key: string; value: string }[]).map((r) => [r.key, r.value])) : null;
        return send(res, 200, { ready: !!d, meta, build: { ...status, running: buildRunning() } });
      }
      if (!d) return send(res, 503, { error: 'NOT_BUILT' });

      if (route === 'explore' && req.method === 'POST') return send(res, 200, explore(d, await readJson(req)));
      if (route === 'games') return send(res, 200, searchGames(d, url.searchParams));
      if (route === 'game') {
        const game = d.prepare(`SELECT ${GAME_COLUMNS}, g.moves, g.source FROM games g WHERE g.id = ?`).get(int(url.searchParams.get('id'), 0));
        return game ? send(res, 200, game) : send(res, 404, { error: 'Game not found' });
      }
      if (route === 'players') {
        const q = (url.searchParams.get('q') ?? '').toLowerCase().trim();
        if (url.searchParams.get('top'))
          return send(res, 200, d.prepare('SELECT key, name, title, max_elo, games, otb_games, first_year, last_year FROM players WHERE otb_games >= 20 ORDER BY max_elo DESC LIMIT 40').all());
        if (q.length < 2) return send(res, 200, []);
        const like = `%${q.replace(/[%_]/g, '')}%`;
        return send(res, 200, d.prepare('SELECT key, name, title, max_elo, games, otb_games, first_year, last_year FROM players WHERE name_lc LIKE ? ORDER BY games DESC LIMIT 12').all(like));
      }
      if (route === 'player') {
        const data = dossier(d, url.searchParams.get('key') ?? '', url.searchParams.get('online') === '1');
        return data ? send(res, 200, data) : send(res, 404, { error: 'Player not found' });
      }
      return send(res, 404, { error: 'Unknown endpoint' });
    } catch (e) {
      console.error('[db]', e);
      return send(res, 500, { error: 'Database error' });
    }
  };
  return {
    name: 'chess-db-api',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}
