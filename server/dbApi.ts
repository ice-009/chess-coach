// Local API over data/masters.db (built by scripts/db). Runs inside the Vite dev/preview server.
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import type { Connect, Plugin } from 'vite';
import type { ServerResponse } from 'node:http';
import { DATA_DIR, DB_PATH, ROOT, STATUS_PATH, loadOpenings } from '../scripts/db/common.ts';
import { dbInfo, meta, query } from '../src/lib/dbQueries.ts';
import type { DbInfo, SqlDb } from '../src/lib/dbQueries.ts';
import type { BuildStatus } from '../scripts/db/common.ts';

let db: DatabaseSync | null = null;
let sql: SqlDb | null = null;
let info: DbInfo = { exploreCache: false, openingsTable: false };
let dbMtime = 0;
let openings: Map<number, { eco: string; name: string }> | null = null;

/** Opens the database read-only, reopening it after a rebuild replaced the file. */
function getDb(): SqlDb | null {
  if (!fs.existsSync(DB_PATH)) return null;
  const mtime = fs.statSync(DB_PATH).mtimeMs;
  if (!db || mtime !== dbMtime) {
    db?.close();
    const d = new DatabaseSync(DB_PATH, { readOnly: true });
    db = d;
    sql = {
      all: (q, params = []) => d.prepare(q).all(...params) as Record<string, unknown>[],
      get: (q, params = []) => d.prepare(q).get(...params) as Record<string, unknown> | undefined,
    };
    info = dbInfo(sql);
    dbMtime = mtime;
    openings = null;
  }
  return sql;
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
      if (route === 'status') return send(res, 200, { ready: !!d, meta: d ? meta(d) : null, build: { ...status, running: buildRunning() } });
      if (!d) return send(res, 503, { error: 'NOT_BUILT' });
      const body = req.method === 'POST' ? await readJson(req) : undefined;
      // databases built before the openings table existed fall back to the opening files
      const [code, data] = query(d, info, route, url.searchParams, body, (key) => getOpenings().get(key));
      return send(res, code, data);
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
