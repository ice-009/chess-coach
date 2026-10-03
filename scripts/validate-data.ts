// Run: node --experimental-strip-types scripts/validate-data.ts
import { Chess } from 'chess.js';
import { OPENINGS } from '../src/data/openings.ts';
import { parseLine } from '../src/lib/chess.ts';

let bad = 0;
for (const o of OPENINGS) for (const l of o.lines) {
  try {
    const moves = parseLine(l.moves);
    const end = new Chess(moves.at(-1)!.fenAfter);
    console.log(`ok  ${l.id.padEnd(20)} ${moves.length} plies${end.isCheckmate() ? ' (mate)' : ''}`);
  } catch (e) {
    bad++;
    console.log(`BAD ${l.id}: ${(e as Error).message}`);
  }
}
if (bad) process.exit(1);

import { ENCYCLOPEDIA } from '../src/data/encyclopedia.ts';
for (const o of ENCYCLOPEDIA) for (const l of o.lines) {
  try {
    const moves = parseLine(l.moves);
    console.log(`ok  ${l.id.padEnd(28)} ${moves.length} plies`);
  } catch (e) {
    bad++;
    console.log(`BAD ${l.id}: ${(e as Error).message}`);
  }
}
if (bad) process.exit(1);

import { CLASSICS } from '../src/data/classics.ts';
for (const g of CLASSICS) {
  try {
    const moves = parseLine(g.moves);
    const end = new Chess(moves.at(-1)!.fenAfter);
    console.log(`ok  ${g.id.padEnd(20)} ${moves.length} plies${end.isCheckmate() ? ' (mate)' : ''}`);
  } catch (e) {
    bad++;
    console.log(`BAD ${g.id}: ${(e as Error).message}`);
  }
}
if (bad) process.exit(1);

import { CHAPTERS } from '../src/data/lessons.ts';
for (const ch of CHAPTERS) for (const l of ch.lessons) for (const [i, s] of l.sections.entries()) {
  if (s.kind === 'text') continue;
  try {
    const fen = s.setup ? parseLine(s.setup).at(-1)!.fenAfter : new Chess(s.fen).fen();
    // chess.js accepts positions where the side NOT to move is in check; those are illegal
    const f = fen.split(' ');
    if (new Chess([f[0], f[1] === 'w' ? 'b' : 'w', f[2], '-', f[4], f[5]].join(' ')).inCheck()) throw new Error('side not to move is in check');
    if (s.kind === 'exercise') for (const sol of s.solutions) new Chess(fen).move(sol);
    console.log(`ok  ${l.id}#${i} ${s.kind} ${fen}`);
  } catch (e) {
    bad++;
    console.log(`BAD ${l.id}#${i}: ${(e as Error).message}`);
  }
}
if (bad) process.exit(1);

import { DRILLS } from '../src/data/drills.ts';
for (const d of DRILLS) {
  try {
    const c = new Chess(d.fen);
    const f = c.fen().split(' ');
    if (new Chess([f[0], f[1] === 'w' ? 'b' : 'w', f[2], '-', f[4], f[5]].join(' ')).inCheck()) throw new Error('side not to move is in check');
    if (c.isGameOver()) throw new Error('position is already over');
    console.log(`ok  drill ${d.id}`);
  } catch (e) {
    bad++;
    console.log(`BAD drill ${d.id}: ${(e as Error).message}`);
  }
}
if (bad) process.exit(1);

// every "Learn" link in the game review must point at a real lesson
import { THEME_LESSON } from '../src/data/themes.ts';
const lessonIds = new Set(CHAPTERS.flatMap((c) => c.lessons.map((l) => l.id)));
for (const [theme, id] of Object.entries(THEME_LESSON)) {
  if (lessonIds.has(id)) console.log(`ok  theme ${theme} -> ${id}`);
  else {
    bad++;
    console.log(`BAD theme ${theme}: no lesson "${id}"`);
  }
}
if (bad) process.exit(1);

// puzzle themes (src/lib/puzzles.ts) link to lessons too; that file imports browser code, so read it as text
import fs from 'node:fs';
const puzzleSrc = fs.readFileSync(new URL('../src/lib/puzzles.ts', import.meta.url), 'utf8');
for (const [, id] of puzzleSrc.matchAll(/lesson: '([a-z0-9-]+)'/g)) {
  if (lessonIds.has(id)) console.log(`ok  puzzle theme lesson ${id}`);
  else {
    bad++;
    console.log(`BAD puzzle theme links to missing lesson "${id}"`);
  }
}
if (bad) process.exit(1);
