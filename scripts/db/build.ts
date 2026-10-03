// Builds data/masters.db from the downloaded PGN files.
// Usage: node --experimental-strip-types scripts/db/build.ts [--min-elo 2000]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR, DB_PATH, MAX_PLY, SOURCES_DIR, hash53, loadOpenings } from './common.ts';
import type { GameRecord } from './worker.ts';
import { report } from './status.ts';

const SCHEMA = `
CREATE TABLE games (
  id INTEGER PRIMARY KEY,
  white TEXT, black TEXT, white_nk TEXT, black_nk TEXT, white_fide TEXT, black_fide TEXT,
  white_key TEXT, black_key TEXT,
  white_elo INTEGER, black_elo INTEGER, white_title TEXT, black_title TEXT,
  result INTEGER, date TEXT, year INTEGER, event TEXT, site TEXT, round TEXT,
  eco TEXT, opening TEXT, plies INTEGER, moves TEXT, source TEXT, online INTEGER, speed TEXT
);
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
`;

function listPgn(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pgn')).map((f) => path.join(dir, f));
}

export async function build(minElo: number, base = 0, span = 1): Promise<number> {
  const files = [
    ...listPgn(path.join(SOURCES_DIR, 'twic')).map((file) => ({ file, source: 'twic' })),
    ...listPgn(path.join(SOURCES_DIR, 'pgnmentor')).map((file) => ({ file, source: 'pgnmentor' })),
    ...listPgn(path.join(SOURCES_DIR, 'custom')).map((file) => ({ file, source: 'custom' })), // your own PGN files
  ];
  if (!files.length) throw new Error('No PGN files found. Run the download step first.');

  const tmp = path.join(DATA_DIR, 'masters.tmp.db');
  const rawPath = path.join(DATA_DIR, 'positions.raw.db');
  for (const f of [tmp, rawPath]) fs.rmSync(f, { force: true });
  const db = new DatabaseSync(tmp);
  db.exec('PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA cache_size=-262144; PRAGMA temp_store=FILE;');
  db.exec(SCHEMA);
  db.exec(`ATTACH '${rawPath}' AS raw; PRAGMA raw.journal_mode=OFF; PRAGMA raw.synchronous=OFF;`);
  db.exec('CREATE TABLE raw.positions (hash INTEGER, online INTEGER, avg_elo INTEGER, game_id INTEGER, ply INTEGER, move TEXT, result INTEGER, year INTEGER)');

  const insGame = db.prepare(`INSERT INTO games VALUES (?,?,?,?,?,?,?,NULL,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insPos = db.prepare('INSERT INTO raw.positions VALUES (?,?,?,?,?,?,?,?)');
  const seen = new Set<number>();
  let id = 0;
  let dupes = 0;

  const store = (records: GameRecord[]) => {
    db.exec('BEGIN');
    for (const r of records) {
      const d = hash53(r.dedupe);
      if (seen.has(d)) {
        dupes++;
        continue;
      }
      seen.add(d);
      id++;
      insGame.run(id, r.white, r.black, r.whiteNk, r.blackNk, r.whiteFide, r.blackFide, r.whiteElo, r.blackElo, r.whiteTitle, r.blackTitle,
        r.result, r.date, r.year, r.event, r.site, r.round, r.eco, r.opening, r.plies, r.moves, r.source, r.online, r.speed);
      // only games where both players are rated get an average (an unrated side would inflate it)
      const avg = r.whiteElo && r.blackElo ? Math.round((r.whiteElo + r.blackElo) / 2) : 0;
      for (let ply = 0; ply < r.keys.length; ply++) insPos.run(r.keys[ply], r.online, avg, id, ply, r.next[ply], r.result, r.year);
    }
    db.exec('COMMIT');
  };

  // parse in parallel: each worker takes the next file from the queue
  const threads = Math.max(2, Math.min(os.cpus().length - 1, 8));
  let nextFile = 0;
  let filesDone = 0;
  await new Promise<void>((resolve, reject) => {
    let alive = threads;
    for (let t = 0; t < threads; t++) {
      const w = new Worker(new URL('./worker.ts', import.meta.url), { workerData: { minElo } });
      const feed = () => w.postMessage(nextFile < files.length ? files[nextFile++] : null);
      w.on('message', (m: { file: string; records: GameRecord[] }) => {
        store(m.records);
        filesDone++;
        report({ state: 'building', step: `Indexing ${path.basename(m.file)} (${filesDone}/${files.length} files, ${id.toLocaleString()} games)`, progress: base + span * 0.75 * (filesDone / files.length) });
        feed();
      });
      w.on('error', reject);
      w.on('exit', () => --alive === 0 && resolve());
      feed();
    }
  });

  report({ step: 'Linking players across sources (FIDE IDs)…', progress: base + span * 0.78 });
  // games without a FIDE ID (historical files) get the ID most often seen with the same name elsewhere
  db.exec(`
    CREATE TABLE nf AS
      SELECT nk, fide, COUNT(*) c FROM (
        SELECT white_nk nk, white_fide fide FROM games WHERE white_fide <> ''
        UNION ALL SELECT black_nk, black_fide FROM games WHERE black_fide <> ''
      ) GROUP BY nk, fide;
    CREATE UNIQUE INDEX nf_key ON nf(nk, fide);
    CREATE TABLE namemap AS
      SELECT nk, fide, c FROM (SELECT nk, fide, c, ROW_NUMBER() OVER (PARTITION BY nk ORDER BY c DESC) rn FROM nf) WHERE rn = 1;
    CREATE UNIQUE INDEX namemap_nk ON namemap(nk);
    UPDATE games SET
      white_key = CASE
        WHEN white_fide = '' THEN COALESCE('f' || (SELECT fide FROM namemap WHERE nk = white_nk), 'n:' || white_nk)
        WHEN (SELECT c FROM nf WHERE nk = white_nk AND fide = white_fide) <= 2 AND (SELECT c FROM namemap WHERE nk = white_nk) >= 50
          THEN 'f' || (SELECT fide FROM namemap WHERE nk = white_nk)
        ELSE 'f' || white_fide END,
      black_key = CASE
        WHEN black_fide = '' THEN COALESCE('f' || (SELECT fide FROM namemap WHERE nk = black_nk), 'n:' || black_nk)
        WHEN (SELECT c FROM nf WHERE nk = black_nk AND fide = black_fide) <= 2 AND (SELECT c FROM namemap WHERE nk = black_nk) >= 50
          THEN 'f' || (SELECT fide FROM namemap WHERE nk = black_nk)
        ELSE 'f' || black_fide END;
    DROP TABLE namemap;
    DROP TABLE nf;
  `);

  report({ step: 'Building player index…', progress: base + span * 0.8 });
  db.exec(`
    CREATE TEMP TABLE appearances AS
      SELECT white_key key, white name, white_title title, white_elo elo, year, online FROM games
      UNION ALL SELECT black_key, black, black_title, black_elo, year, online FROM games;
    CREATE TEMP TABLE names AS
      SELECT key, name FROM (
        SELECT key, name, ROW_NUMBER() OVER (PARTITION BY key ORDER BY COUNT(*) DESC, LENGTH(name) DESC) rn
        FROM appearances GROUP BY key, name
      ) WHERE rn = 1;
    CREATE TABLE players AS
      SELECT s.key, n.name,
        CASE s.t WHEN 9 THEN 'GM' WHEN 8 THEN 'IM' WHEN 7 THEN 'WGM' WHEN 6 THEN 'FM' WHEN 5 THEN 'WIM' WHEN 4 THEN 'CM' WHEN 3 THEN 'WFM' WHEN 2 THEN 'WCM' ELSE '' END AS title,
        s.max_elo, s.games, s.otb_games, s.first_year, s.last_year
      FROM (
        SELECT key, COUNT(*) games, SUM(online = 0) otb_games,
          MAX(CASE WHEN online = 0 THEN elo END) max_elo, -- online events use inflated site ratings
          MIN(NULLIF(year, 0)) first_year, MAX(year) last_year,
          MAX(CASE title WHEN 'GM' THEN 9 WHEN 'IM' THEN 8 WHEN 'WGM' THEN 7 WHEN 'FM' THEN 6 WHEN 'WIM' THEN 5 WHEN 'CM' THEN 4 WHEN 'WFM' THEN 3 WHEN 'WCM' THEN 2 ELSE 0 END) t
        FROM appearances GROUP BY key
      ) s JOIN names n USING (key);
    DROP TABLE appearances;
    DROP TABLE names;
  `);
  db.exec(`
    ALTER TABLE players ADD COLUMN name_lc TEXT;
    UPDATE players SET name_lc = LOWER(name);
    CREATE INDEX players_name ON players(name_lc);
    CREATE INDEX players_games ON players(games);
    CREATE UNIQUE INDEX players_key ON players(key);
  `);

  report({ step: 'Sorting the position index (the longest step)…', progress: base + span * 0.84 });
  db.exec(`
    CREATE TABLE positions (
      hash INTEGER, online INTEGER, avg_elo INTEGER, game_id INTEGER, ply INTEGER, move TEXT, result INTEGER, year INTEGER,
      PRIMARY KEY (hash, online, avg_elo, game_id, ply)
    ) WITHOUT ROWID;
    INSERT INTO positions SELECT * FROM raw.positions ORDER BY hash, online, avg_elo, game_id, ply;
  `);
  db.exec('DETACH raw');
  fs.rmSync(rawPath, { force: true });

  // opening names by position, so the server doesn't have to replay ~3,500 lines on startup
  db.exec('CREATE TABLE openings (hash INTEGER PRIMARY KEY, eco TEXT, name TEXT)');
  const insOpening = db.prepare('INSERT OR REPLACE INTO openings VALUES (?, ?, ?)');
  db.exec('BEGIN');
  for (const [hash, o] of loadOpenings()) insOpening.run(hash, o.eco, o.name);
  db.exec('COMMIT');

  // the busiest positions (first moves) are what everyone opens first: precompute their explorer answers
  report({ step: 'Precomputing the most popular positions…', progress: base + span * 0.92 });
  db.exec('CREATE TABLE explore_cache (hash INTEGER, online INTEGER, min_elo INTEGER, moves TEXT, top TEXT, PRIMARY KEY (hash, online, min_elo)) WITHOUT ROWID');
  const hot = db.prepare('SELECT hash FROM positions GROUP BY hash HAVING COUNT(*) >= 15000').all() as { hash: number }[];
  const movesQ = db.prepare(
    `SELECT move, COUNT(*) n, SUM(result = 1) w, SUM(result = 0) d, SUM(result = -1) b,
            CAST(AVG(NULLIF(avg_elo, 0)) AS INTEGER) elo, MAX(year) last
     FROM positions WHERE hash = ? AND online <= ? AND avg_elo >= ? GROUP BY move ORDER BY n DESC`,
  );
  const topQ = db.prepare('SELECT game_id, ply FROM positions WHERE hash = ? AND online <= ? AND avg_elo >= ? ORDER BY avg_elo DESC LIMIT 24');
  const insCache = db.prepare('INSERT INTO explore_cache VALUES (?, ?, ?, ?, ?)');
  db.exec('BEGIN');
  for (const { hash } of hot)
    for (const online of [0, 1])
      for (const minElo of [0, 2200, 2400, 2600])
        insCache.run(hash, online, minElo, JSON.stringify(movesQ.all(hash, online, minElo)), JSON.stringify(topQ.all(hash, online, minElo)));
  db.exec('COMMIT');

  report({ step: 'Creating search indexes…', progress: base + span * 0.95 });
  db.exec(`
    CREATE INDEX games_white ON games(white_key, year);
    CREATE INDEX games_black ON games(black_key, year);
    CREATE INDEX games_year ON games(year);
    CREATE INDEX games_eco ON games(eco);
    CREATE INDEX games_date ON games(date);
    ANALYZE;
  `);
  const years = db.prepare('SELECT MIN(NULLIF(year,0)) lo, MAX(year) hi FROM games').get() as { lo: number; hi: number };
  const bySource = db.prepare('SELECT source, COUNT(*) n FROM games GROUP BY source').all();
  const online = (db.prepare('SELECT COUNT(*) n FROM games WHERE online = 1').get() as { n: number }).n;
  const setMeta = db.prepare('INSERT INTO meta VALUES (?, ?)');
  for (const [k, v] of Object.entries({
    games: id,
    players: (db.prepare('SELECT COUNT(*) n FROM players').get() as { n: number }).n,
    duplicates_skipped: dupes,
    first_year: years.lo,
    last_year: years.hi,
    sources: JSON.stringify(bySource),
    online_games: online,
    otb_games: id - online,
    max_ply: MAX_PLY,
    hot_positions: hot.length,
    min_elo: minElo,
    built_at: new Date().toISOString(),
  }))
    setMeta.run(k, String(v));
  db.close();
  fs.renameSync(tmp, DB_PATH);
  return id;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--min-elo');
  const t0 = Date.now();
  build(i > 0 ? Number(process.argv[i + 1]) : 2000).then((n) => {
    report({ state: 'done', step: `Done: ${n.toLocaleString()} games`, progress: 1, games: n, finishedAt: Date.now() });
    console.log(`built ${DB_PATH} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  });
}
