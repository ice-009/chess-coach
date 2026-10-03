// Exports data/puzzles.db as static JSON files for the hosted build (Lichess puzzles are CC0, so they may be
// published). Layout: manifest.json, b<band>.json (one per 50-point rating band), idx/<charCode>.json (id → band).
// Usage: node --experimental-strip-types scripts/puzzles/export-static.ts <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PUZZLE_DB_PATH } from '../db/common.ts';

const out = process.argv[2];
if (!out) throw new Error('Usage: export-static.ts <outDir>');
if (!fs.existsSync(PUZZLE_DB_PATH)) throw new Error('data/puzzles.db not found. Run `npm run puzzles:update` first.');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'idx'), { recursive: true });

const db = new DatabaseSync(PUZZLE_DB_PATH, { readOnly: true });
const rows = db.prepare('SELECT id, fen, moves, rating, themes, game_url FROM puzzles ORDER BY rating').all() as {
  id: string;
  fen: string;
  moves: string;
  rating: number;
  themes: string;
  game_url: string;
}[];
const bands = new Map<number, unknown[]>();
const idx = new Map<number, Record<string, number>>();
for (const r of rows) {
  const b = Math.floor(r.rating / 50);
  if (!bands.has(b)) bands.set(b, []);
  bands.get(b)!.push([r.id, r.fen, r.moves, r.rating, r.themes, r.game_url.replace('https://lichess.org/', '')]);
  const c = r.id.charCodeAt(0); // char codes, not letters: "a.json" and "A.json" collide on case-insensitive disks
  if (!idx.has(c)) idx.set(c, {});
  idx.get(c)![r.id] = b;
}
let bytes = 0;
const write = (file: string, data: unknown) => {
  const s = JSON.stringify(data);
  bytes += s.length;
  fs.writeFileSync(path.join(out, file), s);
};
const files: string[] = [];
for (const [b, list] of bands) write((files[files.length] = `b${b}.json`), list);
for (const [c, map] of idx) write((files[files.length] = `idx/${c}.json`), map);
// files + bytes let the app save every puzzle for offline use in one go
write('manifest.json', { count: rows.length, bands: Object.fromEntries([...bands].map(([b, l]) => [b, l.length])), files, bytes });
console.log(`exported ${rows.length} puzzles: ${bands.size} band files, ${idx.size} index files, ${(bytes / 1e6).toFixed(1)} MB`);
