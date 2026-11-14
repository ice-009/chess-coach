// Bots, the live coach, saved bot games, courses and rush modes in a real browser.
// Usage: npm run test:play [-- <app url>]   (app must be running)
import { chromium } from 'playwright-core';
import { Chess } from 'chess.js';

const URL = process.argv[2] || 'http://localhost:5173/';
const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

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
const fen = () => page.$eval('.play-board-wrap .board-box', (e) => e.dataset.fen);
async function play(san) {
  await page.waitForFunction(() => document.querySelector('.play-board-wrap .board-box')?.dataset.fen.split(' ')[1] === 'w', null, { timeout: 30000 });
  const m = new Chess(await fen()).move(san);
  await page.locator(`.play-board-wrap [data-square="${m.from}"]`).first().click();
  await page.locator(`.play-board-wrap [data-square="${m.to}"]`).first().click();
}

const START = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
await page.goto(URL);
await page.evaluate(() => {
  localStorage.setItem('cca-bot-coach', 'true');
  localStorage.setItem('cca-bot-tc', '"none"');
  localStorage.removeItem('cca-bot-games');
});

await step('bot gallery: ten bots, picking one shows its card', async () => {
  await page.goto(URL + '#/practice?bot=milo&fen=' + encodeURIComponent(START));
  await page.waitForSelector('.bot-card');
  const n = await page.locator('.bot-card').count();
  if (n !== 10) throw new Error(`${n} bots`);
  const name = await page.locator('.bot-hero-name').innerText();
  if (name !== 'Milo') throw new Error(`hero shows ${name}`);
});

await step('the coach stops a blunder before the bot answers', async () => {
  await page.click('.bot-hero .btn-green');
  await play('Ba6');
  const w = await page.waitForSelector('.coach-warning', { timeout: 30000 });
  const text = await w.innerText();
  if (!/bishop/i.test(text)) throw new Error(`warning: ${text}`);
  return text.split('\n').slice(1, 2).join(' ');
});

await step('“Take it back” restores the position', async () => {
  await page.click('.coach-warning .btn-green');
  await page.waitForSelector('.coach-warning', { state: 'detached' });
  if ((await fen()) !== START) throw new Error(`fen is ${await fen()}`);
});

await step('a good move gets a grade and the bot answers', async () => {
  await play('Nf3');
  await page.waitForSelector('.coach-msg.grade', { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('.play-board-wrap .board-box')?.dataset.fen.split(' ')[1] === 'w', null, { timeout: 30000 });
  return (await page.locator('.coach-msg.grade').last().innerText()).slice(0, 90);
});

await step('hints come in steps: idea, then the piece', async () => {
  const before = await page.locator('.coach-msg.hint').count();
  await page.click('.puzzle-side .row button:has-text("Hint")');
  await page.waitForFunction((n) => document.querySelectorAll('.coach-msg.hint').length > n, before, { timeout: 30000 });
  await page.click('.puzzle-side .row button:has-text("Which piece")');
  await page.waitForFunction((n) => document.querySelectorAll('.coach-msg.hint').length > n + 1, before, { timeout: 30000 });
});

await step('resigning saves the game; it can be reviewed later', async () => {
  await page.click('.puzzle-side .row button:has-text("Resign")');
  await page.waitForSelector('.game-over');
  await page.goto(URL + '#/practice');
  await page.waitForSelector('.bot-recent li a');
  await page.locator('.bot-recent li a').first().click();
  await page.waitForSelector('.summary', { timeout: 120000 });
});

await step('courses: a step can be marked done and the course shows progress', async () => {
  await page.goto(URL + '#/courses/foundations');
  await page.waitForSelector('.course-path');
  await page.locator('.step-mark').first().click();
  await page.waitForSelector('.step.done');
  await page.goto(URL + '#/courses');
  await page.waitForSelector('.continue-card');
  const t = await page.locator('.course-card').first().innerText();
  if (!/1\/10/.test(t)) throw new Error(`card says ${t.replace(/\s+/g, ' ')}`);
  await page.goto(URL + '#/courses/foundations');
  await page.locator('.step.done .step-mark').first().click();
});

await step('Puzzle Rush offers 3 min, 5 min and Survival', async () => {
  await page.goto(URL + '#/train/rush');
  await page.waitForSelector('.rush-start .seg');
  const modes = await page.locator('.rush-start .seg button').allInnerTexts();
  if (!modes.includes('Survival')) throw new Error(modes.join(', '));
});

if (errors.length) {
  failed++;
  console.log(`✗ page errors: ${errors.join(' | ')}`);
}
await browser.close();
console.log(failed ? `\n${failed} failure(s)` : '\nPlay, coach and courses OK');
process.exit(failed ? 1 : 0);
