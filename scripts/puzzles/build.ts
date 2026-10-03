// Builds data/puzzles.db from the Lichess puzzle database (CC0: https://database.lichess.org/#puzzles).
// Keeps well-tested puzzles only and samples up to 8,000 per 50-point rating band (~300k puzzles).
// Usage: node --experimental-strip-types scripts/puzzles/build.ts
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR, PUZZLE_DB_PATH, PUZZLE_STATUS_PATH, SOURCES_DIR } from '../db/common.ts';
import { report } from '../db/status.ts';

const URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
const PER_BAND = 8000;
const status = (u: Parameters<typeof report>[0]) => report(u, PUZZLE_STATUS_PATH);

/**
 * Yields the data frames of a zstd file, skipping "skippable" frames. The Lichess export uses the
 * seekable zstd format (an index stored in skippable frames), which Node's decoder rejects.
 */
function* zstdDataFrames(buf: Buffer): Generator<Buffer> {
  let o = 0;
  while (o < buf.length) {
    const magic = buf.readUInt32LE(o);
    if ((magic & 0xfffffff0) === 0x184d2a50) {
      o += 8 + buf.readUInt32LE(o + 4); // skippable frame: magic + size + payload
      continue;
    }
    if (magic !== 0xfd2fb528) throw new Error(`Not a zstd frame at byte ${o}`);
    const start = o;
    const fhd = buf[o + 4];
    const single = (fhd >> 5) & 1;
    o += 5 + (single ? 0 : 1) + [0, 1, 2, 4][fhd & 3] + [single, 2, 4, 8][fhd >> 6]; // header, window, dict id, content size
    for (;;) {
      const h = buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16);
      o += 3 + (((h >> 1) & 3) === 1 ? 1 : h >>> 3); // RLE blocks store a single byte
      if (h & 1) break; // last block
    }
    if ((fhd >> 2) & 1) o += 4; // content checksum
    yield buf.subarray(start, o);
  }
}

async function download(file: string) {
  if (fs.existsSync(file)) return;
  const res = await fetch(URL);
  if (!res.ok || !res.body) throw new Error(`Download failed (HTTP ${res.status})`);
  const total = Number(res.headers.get('content-length')) || 3e8;
  let got = 0;
  let last = 0;
  const tmp = `${file}.part`;
  const counter = new (await import('node:stream')).Transform({
    transform(chunk, _enc, cb) {
      got += chunk.length;
      if (got - last > 5e6) {
        last = got;
        status({ state: 'downloading', step: `Downloading the Lichess puzzle database (${Math.round(got / 1e6)} / ${Math.round(total / 1e6)} MB)`, progress: 0.6 * (got / total) });
      }
      cb(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(res.body as import('node:stream/web').ReadableStream), counter, fs.createWriteStream(tmp));
  fs.renameSync(tmp, file);
}

export async function buildPuzzles() {
  const dir = path.join(SOURCES_DIR, 'puzzles');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'lichess_db_puzzle.csv.zst');
  status({ state: 'downloading', step: 'Starting…', progress: 0, startedAt: Date.now(), error: undefined, finishedAt: undefined });
  await download(file);

  const tmp = path.join(DATA_DIR, 'puzzles.tmp.db');
  fs.rmSync(tmp, { force: true });
  const db = new DatabaseSync(tmp);
  db.exec(`PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;
    CREATE TABLE puzzles (id TEXT PRIMARY KEY, fen TEXT, moves TEXT, rating INTEGER, themes TEXT, opening TEXT, game_url TEXT, popularity INTEGER, plays INTEGER);
    CREATE TABLE puzzle_themes (theme TEXT, rating INTEGER, id TEXT, PRIMARY KEY (theme, rating, id)) WITHOUT ROWID;
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);`);
  const insP = db.prepare('INSERT INTO puzzles VALUES (?,?,?,?,?,?,?,?,?)');
  const insT = db.prepare('INSERT INTO puzzle_themes VALUES (?,?,?)');

  const bands = new Map<number, number>();
  let seen = 0;
  let kept = 0;
  db.exec('BEGIN');
  const compressed = fs.readFileSync(file);
  let carry = '';
  const handle = (line: string) => {
    if (seen++ === 0) return; // header
    if (seen % 250_000 === 0) {
      status({ state: 'building', step: `Selecting puzzles (${seen.toLocaleString()} read, ${kept.toLocaleString()} kept)`, progress: 0.6 + 0.35 * Math.min(1, seen / 6.2e6) });
      db.exec('COMMIT; BEGIN');
    }
    const [id, fen, moves, ratingS, rdS, popS, playsS, themes, gameUrl, opening] = line.split(',');
    const rating = Number(ratingS);
    if (rating < 400 || rating > 2600 || Number(rdS) > 90 || Number(popS) < 90 || Number(playsS) < 1000) return;
    const band = Math.floor(rating / 50);
    const n = bands.get(band) ?? 0;
    if (n >= PER_BAND) return; // puzzle ids are random, so the first ones per band are a random sample
    bands.set(band, n + 1);
    kept++;
    insP.run(id, fen, moves, rating, themes, (opening ?? '').replace(/_/g, ' '), gameUrl, Number(popS), Number(playsS));
    for (const t of themes.split(' ')) if (t) insT.run(t, rating, id);
  };
  for (const frame of zstdDataFrames(compressed)) {
    const text = carry + zlib.zstdDecompressSync(frame).toString('utf8');
    const lines = text.split('\n');
    carry = lines.pop() ?? ''; // a line can continue in the next frame
    for (const line of lines) if (line) handle(line);
  }
  if (carry) handle(carry);
  if (kept < 1000) throw new Error(`Only ${kept} puzzles were found; the download may be damaged.`);
  db.exec('COMMIT');
  db.exec('CREATE INDEX puzzles_rating ON puzzles(rating); ANALYZE;');
  db.prepare('INSERT INTO meta VALUES (?, ?)').run('puzzles', String(kept));
  db.prepare('INSERT INTO meta VALUES (?, ?)').run('built_at', new Date().toISOString());
  db.close();
  fs.renameSync(tmp, PUZZLE_DB_PATH);
  status({ state: 'done', step: `Done: ${kept.toLocaleString()} puzzles`, progress: 1, games: kept, finishedAt: Date.now() });
  return kept;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  buildPuzzles()
    .then((n) => console.log(`built ${n} puzzles in ${Math.round((Date.now() - t0) / 1000)}s`))
    .catch((e) => {
      status({ state: 'error', step: 'Failed', error: (e as Error).message, finishedAt: Date.now() });
      console.error(e);
      process.exitCode = 1;
    });
}
