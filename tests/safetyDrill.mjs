// The "Is it safe?" drill end to end: a round of 10 in the browser (positions found and verified by the app's
// Stockfish), each answer explained and played out on the board, the stats and the round summary, and every
// verdict cross-checked by a deeper Stockfish search in Node. Usage: npm run test:safe-drill [-- <app url>]
import { chromium } from 'playwright-core';
import { afterMove } from '../src/lib/safety.ts';
import { engine } from './stockfish-node.mjs';

const URL = process.argv[2] || 'http://localhost:5173/';
let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) failed++;
};
const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
const page = await browser.newPage({ viewport: { width: 1366, height: 860 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${URL}#/train/safe`);
const sf = await engine();
const winPct = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
async function moverScore(fen) {
  const e = await sf.evaluate(fen, 16);
  return (fen.split(' ')[1] === 'w' ? 1 : -1) * e.cp; // e.cp is from White's side (mate = ±10000)
}

const asked = [];
for (let n = 0; n < 10; n++) {
  await page.waitForSelector('.safety-ask', { timeout: 90000 }).catch(async (e) => {
    await page.screenshot({ path: 'test-results/safety-no-question.png' });
    throw new Error(`no position ${n + 1} after 90 s: “${(await page.locator('main.app').innerText()).replace(/\s+/g, ' ').slice(-200)}” (${e.message.split('\n')[0]})`);
  });
  const [fen, uci] = (await page.locator('.safety').getAttribute('data-q')).split('|');
  const arrow = await page.locator('.board-box').getAttribute('data-fen');
  if (n === 0) check(arrow === fen && /about to play/.test(await page.locator('.safety-ask').innerText()), 'a position and a move to judge are shown');
  const before = Number(await page.evaluate(() => JSON.parse(localStorage.getItem('cca-safety') ?? '{"total":0}').total));
  await page.keyboard.press(n % 2 ? 'n' : 's');
  await page.waitForSelector('.quick-result', { timeout: 15000 }).catch(async (e) => {
    await page.screenshot({ path: 'test-results/safety-stuck.png' });
    throw new Error(`no answer registered at position ${n + 1}: “${(await page.locator('.puzzle-side').innerText()).replace(/\s+/g, ' ').slice(0, 200)}” (${e.message.split('\n')[0]})`);
  });
  const verdict = await page.locator('.safety').getAttribute('data-verdict');
  const explain = await page.locator('.quick-explain').innerText();
  asked.push({ fen, uci, verdict, explain });
  if (n === 0) {
    check(explain.length > 10, `the answer is explained: “${explain}”`);
    await page.waitForTimeout(1600);
    const shown = await page.locator('.board-box').getAttribute('data-fen');
    check(shown !== fen, 'the move is played out on the board');
    const after = Number(await page.evaluate(() => JSON.parse(localStorage.getItem('cca-safety')).total));
    check(after === before + 1, 'the answer is counted');
  }
  await page.keyboard.press('Enter'); // after the 10th: “See results”
}
await page.waitForSelector('.safety-summary');
check(/of 10 right/.test(await page.locator('.safety-summary h3').innerText()), `the round ends with a summary: “${await page.locator('.safety-summary h3').innerText()}”`);
const kinds = asked.map((a) => a.verdict);
check(kinds.includes('safe') && kinds.includes('unsafe'), `both safe and unsafe moves come up (${kinds.join(' ')})`);

// every verdict agrees with a deeper search
let agree = 0;
for (const a of asked) {
  const best = await moverScore(a.fen);
  const now = -(await moverScore(afterMove(a.fen, a.uci)));
  const loss = winPct(best) - winPct(now);
  const ok = a.verdict === 'unsafe' ? loss >= 8 : loss <= 10;
  if (ok) agree++;
  else console.log(`   disagreement: ${a.uci} in ${a.fen} judged ${a.verdict}, deeper search loses ${loss.toFixed(1)}%`);
}
check(agree === asked.length, `every verdict holds up at depth 16 (${agree}/${asked.length})`);
sf.quit();
if (errors.length) {
  failed += errors.length;
  console.log(`✗ page errors: ${errors.join(' | ')}`);
}
await browser.close();
console.log(failed ? `\n${failed} failure(s)` : '\n"Is it safe?" OK');
process.exit(failed ? 1 : 0);
