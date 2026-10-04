// The flight test, in Safari's engine (WebKit) on an iPad-sized screen: with the hosted build served locally,
// save the app and every puzzle for offline use, load the exported master database the way a picked file
// arrives, then switch the server off and use puzzles, lessons, openings, drills, analysis and the database.
// Usage: npm run build:static && npm run test:offline [-- <masters.db>]
//        (default database: ~/Desktop/ChessCoach-masters-otb.db; the database steps are skipped without one)
import { webkit } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 4321;
const URL = `http://localhost:${PORT}/`;
const DB = process.argv[2] || path.join(os.homedir(), 'Desktop', 'ChessCoach-masters-otb.db');
const PROFILE = 'test-results/offline-profile';
const LINK = 'dist/_offline-test.db'; // the page fetches the database file through the test server

let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) failed++;
};

if (!fs.existsSync('dist/sw.js')) {
  console.log('Build the hosted version first: npm run build:static');
  process.exit(1);
}
const hasDb = fs.existsSync(DB);
if (hasDb) fs.symlinkSync(path.resolve(DB), LINK);
fs.rmSync(PROFILE, { recursive: true, force: true });
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: 'dist', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1000));
// a persistent profile: WebKit only gives websites file storage (OPFS) and a service worker there
const ctx = await webkit.launchPersistentContext(PROFILE, { viewport: { width: 1180, height: 820 }, hasTouch: true });
const page = ctx.pages()[0] ?? (await ctx.newPage());
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

try {
  // ── online: save everything ──
  await page.goto(URL);
  await page.waitForSelector('.dash');
  check(await page.evaluate(async () => !!(await navigator.serviceWorker.ready).active), 'the offline service worker is installed');
  await page.goto(URL + '#/offline');
  await page.locator('button', { hasText: 'Save all puzzles' }).click({ timeout: 20000 });
  await page.waitForSelector('text=/puzzles are saved/', { timeout: 300000 });
  check(true, 'all puzzles saved for offline use');

  if (hasDb) {
    await page.goto(URL + '#/database');
    await page.waitForSelector('.device-db', { timeout: 30000 });
    await page.evaluate(async (name) => {
      const blob = await (await fetch('/' + name)).blob();
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'ChessCoach-masters.db'));
      const input = document.querySelector('.device-db input[type=file]');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, path.basename(LINK));
    await page.waitForSelector('.mx-table tbody tr', { timeout: 300000 });
    check(true, `master database loaded onto the device (${(fs.statSync(DB).size / 1e6).toFixed(0)} MB)`);
  } else console.log(`- no database file at ${DB}: database steps skipped`);

  // ── offline ──
  server.kill();
  await new Promise((r) => setTimeout(r, 500));
  await page.goto(URL + '#/');
  await page.reload();
  await page.waitForSelector('.dash .next-up', { timeout: 20000 });
  check(true, 'offline: the app opens');
  const pages = [
    ['train', '.puzzle-board .board-box', 'rated puzzles'],
    ['train/endgames', '.puzzle-board .board-box', 'endgame puzzles'],
    ['train/mates', '.puzzle-board .board-box', 'checkmate puzzles'],
    ['learn/opening-rules', '.lesson .board-box', 'a lesson'],
    ['openings/enc-ruy/enc-ruy-closed', '.op-board .board-box', 'an encyclopedia line'],
    ['practice/drill/two-bishops', '.puzzle-board .board-box', 'an endgame drill'],
    ['explore', '.engine-line', 'the analysis board with Stockfish'],
    ...(hasDb ? [['database', '.mx-table tbody tr', 'the master database explorer']] : []),
  ];
  for (const [route, selector, label] of pages) {
    await page.goto(URL + '#/' + route);
    const ok = await page.waitForSelector(selector, { timeout: 30000 }).then(() => true, () => false);
    check(ok, `offline: ${label}`);
  }
} finally {
  server.kill();
  await ctx.close();
  fs.rmSync(LINK, { force: true });
}
if (errors.length) {
  failed += errors.length;
  console.log(`✗ page errors: ${errors.join(' | ')}`);
}
console.log(failed ? `\n${failed} failure(s)` : '\nOffline OK');
process.exit(failed ? 1 : 0);
