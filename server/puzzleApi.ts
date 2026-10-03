// Local API over data/puzzles.db (built by scripts/puzzles/build.ts). Runs inside the Vite dev/preview server.
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import type { Connect, Plugin } from 'vite';
import type { ServerResponse } from 'node:http';
import { PUZZLE_DB_PATH, PUZZLE_STATUS_PATH, ROOT } from '../scripts/db/common.ts';
import type { BuildStatus } from '../scripts/db/common.ts';

let db: DatabaseSync | null = null;
let mtime = 0;

function getDb(): DatabaseSync | null {
  if (!fs.existsSync(PUZZLE_DB_PATH)) return null;
  const m = fs.statSync(PUZZLE_DB_PATH).mtimeMs;
  if (!db || m !== mtime) {
    db?.close();
    db = new DatabaseSync(PUZZLE_DB_PATH, { readOnly: true });
    mtime = m;
  }
  return db;
}

function readStatus(): BuildStatus {
  try {
    return JSON.parse(fs.readFileSync(PUZZLE_STATUS_PATH, 'utf8')) as BuildStatus;
  } catch {
    return { state: 'idle', step: '', progress: 0 };
  }
}

const running = (s: BuildStatus) => (s.state === 'downloading' || s.state === 'building') && Date.now() - (s.startedAt ?? 0) < 3600_000;

function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

const COLUMNS = 'id, fen, moves, rating, themes, opening, game_url';

/** A random puzzle near the target rating, optionally of one theme, avoiding recently seen ids. */
function nextPuzzle(d: DatabaseSync, q: URLSearchParams) {
  const target = Math.max(400, Math.min(2600, Number(q.get('rating')) || 1000));
  const theme = (q.get('theme') ?? '').replace(/[^A-Za-z0-9]/g, '');
  const exclude = (q.get('exclude') ?? '').split(',').filter((id) => /^[A-Za-z0-9]{5}$/.test(id)).slice(-300);
  const notIn = exclude.length ? `AND id NOT IN (${exclude.map(() => '?').join(',')})` : '';
  // widen the band until something is found (rare themes have few puzzles at some ratings)
  for (const band of [60, 150, 300, 600, 3000]) {
    const row = theme
      ? d
          .prepare(`SELECT ${COLUMNS} FROM puzzles WHERE id = (SELECT id FROM puzzle_themes WHERE theme = ? AND rating BETWEEN ? AND ? ${notIn} ORDER BY random() LIMIT 1)`)
          .get(theme, target - band, target + band, ...exclude)
      : d.prepare(`SELECT ${COLUMNS} FROM puzzles WHERE rating BETWEEN ? AND ? ${notIn} ORDER BY random() LIMIT 1`).get(target - band, target + band, ...exclude);
    if (row) return row;
  }
  return null;
}

export function puzzleApi(): Plugin {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith('/api/puzzles/')) return next();
    const url = new URL(req.url, 'http://local');
    const route = url.pathname.slice('/api/puzzles/'.length);
    try {
      const status = readStatus();
      if (route === 'build' && req.method === 'POST') {
        if (running(status)) return send(res, 409, { error: 'A puzzle build is already running.' });
        spawn(process.execPath, ['--experimental-strip-types', '--no-warnings', 'scripts/puzzles/build.ts'], { cwd: ROOT, detached: true, stdio: 'ignore' }).unref();
        return send(res, 202, { started: true });
      }
      const d = getDb();
      if (route === 'status') {
        const count = d ? Number((d.prepare("SELECT value FROM meta WHERE key = 'puzzles'").get() as { value: string }).value) : 0;
        return send(res, 200, { ready: !!d, count, build: { ...status, running: running(status) } });
      }
      if (!d) return send(res, 503, { error: 'NOT_BUILT' });
      if (route === 'next') {
        const p = nextPuzzle(d, url.searchParams);
        return p ? send(res, 200, p) : send(res, 404, { error: 'No puzzle found' });
      }
      if (route === 'get') {
        const p = d.prepare(`SELECT ${COLUMNS} FROM puzzles WHERE id = ?`).get(url.searchParams.get('id') ?? '');
        return p ? send(res, 200, p) : send(res, 404, { error: 'Puzzle not found' });
      }
      if (route === 'themes') return send(res, 200, d.prepare('SELECT theme, COUNT(*) n FROM puzzle_themes GROUP BY theme').all());
      return send(res, 404, { error: 'Unknown endpoint' });
    } catch (e) {
      console.error('[puzzles]', e);
      return send(res, 500, { error: 'Puzzle database error' });
    }
  };
  return {
    name: 'chess-puzzle-api',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}
