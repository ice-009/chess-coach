// Opening quiz in a real browser: plays whole sessions with book moves (must pass), with a deliberate mistake
// (must be counted), as White, as Black and with both colours, and checks the computer varies its lines.
// Usage: npm run test:quiz [-- <app url>]   (the app must be running)
import { chromium } from 'playwright-core';
import { Chess } from 'chess.js';
import { ENCYCLOPEDIA } from '../src/data/encyclopedia.ts';
import { parseLine } from '../src/lib/chess.ts';

const URL = process.argv[2] || 'http://localhost:5173/';
const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) failed++;
};

const key = (fen) => fen.split(' ').slice(0, 4).join(' ');
/** All book moves from this position in the opening's lines, with the line each belongs to. */
function bookMoves(openingId, fen) {
  const o = ENCYCLOPEDIA.find((x) => x.id === openingId);
  const out = [];
  for (const l of o.lines) for (const m of parseLine(l.moves)) if (key(m.fenBefore) === key(fen)) out.push({ uci: m.uci, line: l.name, id: l.id });
  return out;
}
async function click(uci) {
  await page.locator(`.quiz-round [data-square="${uci.slice(0, 2)}"]`).click();
  await page.locator(`.quiz-round [data-square="${uci.slice(2, 4)}"]`).click();
}

/** Plays one session; `mistakeInRound` makes one wrong move at the user's first turn of that round. */
async function session(openingId, color, mistakeInRound = -1) {
  await page.goto(`${URL}#/openings/quiz?scope=${openingId}&color=${color}`);
  await page.waitForSelector('.quiz-round .board-box');
  const total = Number((await page.locator('.quiz-head .muted').innerText()).match(/of (\d+)/)[1]);
  const results = [];
  for (let round = 0; round < total; round++) {
    let mistakeMade = round !== mistakeInRound;
    for (let guard = 0; guard < 80; guard++) {
      if (await page.locator('.quiz-result').count()) break;
      const status = await page.locator('.quiz-round .puzzle-status b').innerText();
      if (!/Your move/.test(status)) {
        await page.waitForTimeout(250);
        continue;
      }
      const fen = await page.$eval('.quiz-round .board-box', (e) => e.dataset.fen);
      if (!mistakeMade) {
        const legal = new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to);
        const book = bookMoves(openingId, fen).map((m) => m.uci);
        await click(legal.find((u) => !book.includes(u)));
        mistakeMade = true;
        await page.waitForTimeout(200);
        continue;
      }
      const options = bookMoves(openingId, fen);
      if (!options.length) throw new Error(`no book move found in ${fen}`);
      // like a player who knows every line: at a branch, follow the line the computer is playing
      const target = await page.locator('.quiz-round').getAttribute('data-line');
      const pick = options.find((o) => o.id === target) ?? options[0];
      await click(pick.uci);
      await page.waitForTimeout(250);
    }
    const text = (await page.locator('.quiz-result').innerText()).replace(/\s+/g, ' ');
    results.push(text);
    await page.locator('.quiz-result button').click();
    await page.waitForTimeout(300);
  }
  const summary = await page.locator('.quiz-summary h2').innerText();
  return { total, results, summary };
}

const ruy = await session('enc-ruy', 'w');
check(ruy.total === 4, `Ruy Lopez as White: ${ruy.total} rounds (4 lines)`);
check(ruy.results.every((r) => r.startsWith('✓ Passed')), 'every line passed with book moves');
const lineOf = (r) => r.match(/^[^:]*: [^,]*, (.*?) \(as (?:White|Black)\)/)?.[1] ?? r;
const names = new Set(ruy.results.map(lineOf));
check(names.size === 4, `the computer chose a different line each round (${[...names].join(' | ')})`);
check(/Quiz passed/.test(ruy.summary), `summary: ${ruy.summary}`);

const najdorf = await session('enc-najdorf', 'b', 0);
check(najdorf.results[0].startsWith('✗ 1 mistake'), `a wrong move counts as a mistake: "${najdorf.results[0].slice(0, 70)}"`);
check(najdorf.results.slice(1).every((r) => r.startsWith('✓ Passed')), 'the other Najdorf line passed as Black (computer moved first)');
check(/1 of 2 lines passed/.test(najdorf.summary), `summary: ${najdorf.summary}`);
check((await page.locator('button', { hasText: 'Retry the 1 failed line' }).count()) === 1, 'offers to retry the failed line');

const scotch = await session('enc-scotch', 'mixed');
check(scotch.total === 4, `Scotch with both colours: ${scotch.total} rounds (2 lines × 2 colours)`);
check(scotch.results.filter((r) => /as White/.test(r)).length === 2 && scotch.results.filter((r) => /as Black/.test(r)).length === 2, 'two rounds as White, two as Black');

await page.goto(`${URL}#/openings/quiz?scope=repertoire`);
await page.waitForSelector('.quiz-setup');
check((await page.locator('.quiz-setup .btn-green').innerText()) === 'My side of each line', 'repertoire quiz suggests “My side of each line”');
await page.locator('.quiz-setup .btn-green').click();
await page.waitForSelector('.quiz-round .board-box');
const firstSide = await page.locator('.quiz-round .puzzle-status .muted').innerText();
check(/You play (White|Black)/.test(firstSide), `my-side round starts: ${firstSide.split('.')[0]}`);

await page.goto(`${URL}#/openings?view=encyclopedia`);
await page.waitForSelector('.card');
const badge = await page.locator('.card', { hasText: 'Ruy Lopez' }).locator('.quiz-badge').allInnerTexts();
check(badge.includes('✓ White'), `Ruy Lopez card shows the quiz badge: ${badge.join(', ')}`);

if (errors.length) {
  failed += errors.length;
  console.log(`✗ page errors: ${errors.join(' | ')}`);
}
await browser.close();
console.log(failed ? `\n${failed} failure(s)` : '\nOpening quiz OK');
process.exit(failed ? 1 : 0);
