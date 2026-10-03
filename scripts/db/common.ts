// Shared by the database build scripts and the local API server.
import { Chess } from 'chess.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { positionKey } from '../../src/lib/positionKey.ts';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DATA_DIR = path.join(ROOT, 'data');
export const SOURCES_DIR = path.join(DATA_DIR, 'sources');
export const DB_PATH = path.join(DATA_DIR, 'masters.db');
export const STATUS_PATH = path.join(DATA_DIR, 'build-status.json');
export const PUZZLE_DB_PATH = path.join(DATA_DIR, 'puzzles.db');
export const PUZZLE_STATUS_PATH = path.join(DATA_DIR, 'puzzle-status.json');

/** Positions are indexed up to this ply (move 20), which covers openings and the early middlegame. */
export const MAX_PLY = 40;

export { hash53, normalizeFen, positionKey } from '../../src/lib/positionKey.ts';

/** "Carlsen, Magnus" / "Carlsen,M" / "carlsen , m." → "carlsen,m" */
export function nameKey(name: string): string {
  const clean = name.toLowerCase().replace(/[.\s]+/g, ' ').trim();
  const [last, first = ''] = clean.split(',').map((s) => s.trim());
  return `${last.replace(/\s+/g, ' ')},${first.charAt(0)}`;
}

export interface PgnGame {
  headers: Record<string, string>;
  movetext: string;
}

/** Splits a PGN file into games and their header tags. */
export function splitPgn(text: string): PgnGame[] {
  const out: PgnGame[] = [];
  for (const chunk of text.replace(/\r\n?/g, '\n').split(/\n(?=\[Event )/)) {
    const headers: Record<string, string> = {};
    let lastHeaderEnd = 0;
    for (const m of chunk.matchAll(/^\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/gm)) {
      headers[m[1]] = m[2];
      lastHeaderEnd = (m.index ?? 0) + m[0].length;
    }
    if (!Object.keys(headers).length) continue;
    out.push({ headers, movetext: chunk.slice(lastHeaderEnd) });
  }
  return out;
}

/** SAN tokens of the main line: comments, variations, NAGs, move numbers and results removed. */
export function sanTokens(movetext: string): string[] {
  let t = movetext.replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ');
  // strip (possibly nested) variations
  let prev = '';
  while (prev !== t) {
    prev = t;
    t = t.replace(/\([^()]*\)/g, ' ');
  }
  return t
    .replace(/\$\d+/g, ' ')
    .replace(/\d+\.(\.\.)?/g, ' ')
    .split(/\s+/)
    .map((s) => s.replace(/[!?]+$/, ''))
    .filter((s) => s && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(s));
}

export const resultCode = (r: string | undefined) => (r === '1-0' ? 1 : r === '0-1' ? -1 : r === '1/2-1/2' ? 0 : null);

export interface BuildStatus {
  state: 'idle' | 'downloading' | 'building' | 'done' | 'error';
  step: string;
  progress: number; // 0–1
  startedAt?: number;
  finishedAt?: number;
  error?: string;
  games?: number;
}

/** Opening names (lichess chess-openings, CC0): final position of each named line → ECO + name. */
export function loadOpenings(): Map<number, { eco: string; name: string }> {
  const openings = new Map<number, { eco: string; name: string }>();
  for (const f of ['a', 'b', 'c', 'd', 'e']) {
    const file = path.join(SOURCES_DIR, 'openings', `${f}.tsv`);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n').slice(1)) {
      const [eco, name, pgn] = line.split('\t');
      if (!pgn) continue;
      const c = new Chess();
      try {
        for (const san of sanTokens(pgn)) c.move(san);
        openings.set(positionKey(c.fen()), { eco, name });
      } catch {
        // skip malformed lines
      }
    }
  }
  return openings;
}
