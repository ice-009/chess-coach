// Smoke test of the main flows in a real browser. Usage: npm run test:smoke [-- <app url>]
// Needs the app running (npm run dev / npm start). Uses chess.com's public API for the game-review step.
import { chromium } from 'playwright-core';
import { Chess } from 'chess.js';

const URL = process.argv[2] || 'http://localhost:5173/';
const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/api\.chess\.com|Failed to load resource/.test(m.text()) && errors.push(m.text()));

let failed = 0;
async function step(name, fn) {
  const t0 = Date.now();
  try {
    const note = await fn();
    console.log(`✓ ${name} (${Date.now() - t0} ms)${note ? ': ' + note : ''}`);
  } catch (e) {
    failed++;
    console.log(`✗ ${name}: ${e.message.split('\n')[0]}`);
  }
}
const fenOf = (scope) => page.$eval(`${scope} .board-box`, (e) => e.dataset.fen);
async function play(scope, san) {
  const m = new Chess(await fenOf(scope)).move(san);
  await page.locator(`${scope} [data-square="${m.from}"]`).first().click();
  await page.locator(`${scope} [data-square="${m.to}"]`).first().click();
}

await step('home loads', async () => {
  await page.goto(URL);
  await page.waitForSelector('.dash .next-up');
});

await step('game review: Stockfish classifies every move', async () => {
  await page.goto(URL + '#/games/hikaru');
  await page.waitForSelector('.games-table tbody tr', { timeout: 60000 });
  await page.locator('.games-table tbody tr').first().click();
  await page.waitForSelector('.summary', { timeout: 60000 });
  await page.waitForSelector('.stage-bar', { state: 'detached', timeout: 180000 });
  const acc = await page.locator('.acc-box').allInnerTexts();
  await page.locator('.btn-green.big').click();
  await page.waitForSelector('.why-card, .coach-title');
  return `accuracy ${acc.join(' / ')}`;
});

for (const [name, route] of [['rated puzzle', 'train'], ['endgame puzzle', 'train/endgames/rookEndgame'], ['checkmate puzzle', 'train/mates/smotheredMate']]) {
  await step(`${name} loads`, async () => {
    await page.goto(URL + '#/' + route);
    const el = await page.waitForSelector('.puzzle-play[data-themes]', { timeout: 60000 });
    const theme = route.split('/')[2];
    const themes = await el.getAttribute('data-themes');
    if (theme && !themes.split(' ').includes(theme)) throw new Error(`puzzle without the ${theme} theme`);
    return themes.split(' ').slice(0, 4).join(' ');
  });
}

await step('lesson exercise accepts the right move', async () => {
  await page.goto(URL + '#/learn/basic-mates');
  await page.waitForSelector('.exercise');
  await play('.exercise', 'Ra8#');
  await page.waitForTimeout(400);
  if (!/Correct/.test(await page.locator('.exercise').first().innerText())) throw new Error('not marked correct');
});

await step('opening drill (repertoire)', async () => {
  await page.goto(URL + '#/openings/italian/italian-giuoco?mode=drill');
  await page.waitForSelector('.op-board [data-square="e2"]');
  await play('.op-board', 'e4');
  await page.waitForTimeout(900);
  return await page.locator('.op-panel .note').innerText();
});

await step('opening encyclopedia: study a line', async () => {
  await page.goto(URL + '#/openings?view=encyclopedia');
  await page.waitForSelector('.card');
  const cards = await page.locator('.card').count();
  await page.goto(URL + '#/openings/enc-qgd/enc-qgd-orthodox');
  await page.waitForSelector('.op-board .board-box');
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  return `${cards} openings · ${(await page.locator('.big-note').innerText()).slice(0, 60)}`;
});

await step('endgame drill: two bishops starts', async () => {
  await page.goto(URL + '#/practice/drill/two-bishops');
  await page.waitForSelector('.puzzle-board .board-box');
  await play('.puzzle-board', 'Kd2');
  await page.waitForTimeout(1500);
  return (await page.locator('.puzzle-play').innerText()).match(/Checkmate within[^\n]*/)?.[0] ?? '';
});

await step('analysis board: engine lines', async () => {
  await page.goto(URL + '#/explore');
  await page.waitForSelector('.engine-line', { timeout: 60000 });
  return (await page.locator('.engine-line').first().innerText()).slice(0, 40);
});

await step('master database (server or on-device)', async () => {
  await page.goto(URL + '#/database');
  await page.waitForSelector('.mx-table tbody tr, .device-db, .db-setup', { timeout: 60000 });
  if (await page.locator('.mx-table tbody tr').count()) return 'explorer: ' + (await page.locator('.mx-table tbody tr').first().innerText()).replace(/\s+/g, ' ');
  return 'no database here (setup card shown)';
});

if (errors.length) {
  failed += errors.length;
  console.log(`✗ page errors:\n  ${errors.join('\n  ')}`);
}
await browser.close();
console.log(failed ? `\n${failed} failure(s)` : '\nAll smoke tests passed');
process.exit(failed ? 1 : 0);
