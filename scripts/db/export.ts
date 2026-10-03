// npm run db:export: writes a compact, standalone copy of the master database for another device, e.g. an iPad
// (AirDrop it, then load it on the hosted site's Offline page). For personal use only: TWIC's licence.
// Options: --otb (over-the-board games only, about half the size), --out <file> (default: ~/Desktop).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DB_PATH } from './common.ts';

const args = process.argv.slice(2);
const otbOnly = args.includes('--otb');
const outArg = args.indexOf('--out');
const out = path.resolve(outArg >= 0 ? args[outArg + 1] : path.join(os.homedir(), 'Desktop', `ChessCoach-masters${otbOnly ? '-otb' : ''}.db`));

if (!fs.existsSync(DB_PATH)) throw new Error('data/masters.db not found: build the database first (Database page, or npm run db:update).');
fs.rmSync(out, { force: true });
console.log(`Writing ${out}…`);
const t0 = Date.now();
const src = new DatabaseSync(DB_PATH, { readOnly: true });
// VACUUM INTO makes a defragmented single-file copy (no journal), which is what the device importer expects
src.exec(`VACUUM INTO '${out.replaceAll("'", "''")}'`);
src.close();

if (otbOnly) {
  const db = new DatabaseSync(out);
  db.exec('DELETE FROM positions WHERE online = 1; DELETE FROM games WHERE online = 1;');
  db.exec("DELETE FROM explore_cache WHERE online = 1; UPDATE meta SET value = '0' WHERE key = 'online_games';");
  db.exec("UPDATE meta SET value = (SELECT value FROM meta WHERE key = 'otb_games') WHERE key = 'games';");
  db.exec('VACUUM');
  db.close();
}
const size = fs.statSync(out).size;
console.log(`Done in ${Math.round((Date.now() - t0) / 1000)}s: ${(size / 1e9).toFixed(2)} GB.
Next: AirDrop it to your iPad (Save to Files), open ChessCoach there, go to Offline and tap "Choose the database file".`);
