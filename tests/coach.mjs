// The clock and tilt coach on the dashboard, with chess.com replaced by a week of rapid games played mostly in
// under 5 seconds, the last two lost within the hour: the clock card, the break banner, the plan's "Is it
// safe?" item, the "slow down" and most-common-mistake focus items, and the clock line in a game's report.
// Runs in Chrome and WebKit. Usage: npm run test:coach [-- <app url>]
import { chromium, webkit } from 'playwright-core';

const URL = process.argv[2] || 'http://localhost:5173/';
const USER = 'clocktester';
const now = Math.floor(Date.now() / 1000);
const clk = (s) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.round(s) % 60).padStart(2, '0')}`;
/** A legal 20-move game (knights shuffling): I'm White and spend `mine(i)` seconds on move i. */
function game(n, outcome, minutesAgo, mine) {
  let w = 600, b = 600, pgn = `[White "${USER}"]\n[Black "opp${n}"]\n[TimeControl "600"]\n\n`;
  const W = ['Nf3', 'Ng1'], B = ['Nf6', 'Ng8'];
  for (let i = 0; i < 20; i++) {
    w -= mine(i);
    b -= 8;
    pgn += `${i + 1}. ${W[i % 2]} {[%clk ${clk(w)}]} ${i + 1}... ${B[i % 2]} {[%clk ${clk(b)}]} `;
  }
  return {
    url: `https://www.chess.com/game/live/${9000 + n}`, pgn, time_control: '600', time_class: 'rapid', end_time: now - minutesAgo * 60, rated: true, rules: 'chess',
    white: { username: USER, rating: 700, result: outcome === 'win' ? 'win' : 'resigned' }, black: { username: `opp${n}`, rating: 710, result: outcome === 'win' ? 'resigned' : 'win' },
  };
}
// six games over the week: 20 s on 4 moves and 3 s on 16 (128 s = 2.1 of 10 minutes used), the last two lost recently
const GAMES = [
  game(1, 'win', 6 * 1440, (i) => (i % 5 === 0 ? 20 : 3)),
  game(2, 'loss', 4 * 1440, (i) => (i % 5 === 0 ? 20 : 3)),
  game(3, 'win', 2 * 1440, (i) => (i % 5 === 0 ? 20 : 3)),
  game(4, 'win', 1440, (i) => (i % 5 === 0 ? 20 : 3)),
  game(5, 'loss', 25, (i) => (i % 5 === 0 ? 20 : 3)),
  game(6, 'loss', 5, (i) => (i % 5 === 0 ? 20 : 3)),
];

async function fakeChessCom(page) {
  await page.route('https://api.chess.com/**', (route) => {
    const u = route.request().url();
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.endsWith('/games/archives')) return json({ archives: [`https://api.chess.com/pub/player/${USER}/games/2026/10`] });
    if (u.includes('/games/2026/10')) return json({ games: GAMES });
    if (u.endsWith('/stats')) return json({ chess_rapid: { last: { rating: 700 } } });
    return json({ username: USER });
  });
}

let failed = 0;
const check = (ok, msg) => {
  console.log(`  ${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) failed++;
};
for (const [name, engine, opts] of [
  ['chrome', chromium, { viewport: { width: 1366, height: 860 }, serviceWorkers: 'block' }],
  // the offline worker is off here: in WebKit the test tool can't fake responses to requests the worker makes
  // (tests/offline.mjs covers the worker)
  ['webkit (iPad)', webkit, { viewport: { width: 1180, height: 820 }, hasTouch: true, serviceWorkers: 'block' }],
]) {
  console.log(name);
  const browser = engine === chromium ? await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' })) : await webkit.launch();
  const page = await browser.newPage(opts);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await fakeChessCom(page);
  await page.goto(URL);
  await page.evaluate(({ user, t }) => {
    localStorage.setItem('cca-me', JSON.stringify(user));
    localStorage.setItem('cca-quick-reviews', JSON.stringify({ a: { date: t, types: ['moved-piece-lost', 'other'], found: 1, total: 2 }, b: { date: t, types: ['moved-piece-lost'], found: 0, total: 1 } }));
  }, { user: USER, t: Date.now() });
  await page.reload();
  await page.waitForSelector('.p-clock', { timeout: 30000 });

  const card = (await page.locator('.p-clock').innerText()).replace(/\s+/g, ' ');
  check(/6 games/.test(card) && /2\.1 of 10 min/.test(card), `the clock card shows time used: “${card.match(/Time used per game [^○✓]*/)?.[0]?.trim()}”`);
  check(/Moves in under 5 seconds 80%/.test(card), `and the share of instant moves (${card.match(/under 5 seconds (\d+%)/)?.[1]})`);
  check((card.match(/○ goal/g) ?? []).length === 2, 'both goals are marked as not yet met, in words');
  check((await page.locator('.clock-games .cg').count()) === 6 && (await page.locator('.clock-games .cg.loss').count()) === 3, 'a bar per game, won and lost told apart');
  const tilt = await page.locator('.nudge.tilt').innerText().catch(() => '');
  check(/2 losses in a row/.test(tilt), `the break banner: “${tilt.replace(/\s+/g, ' ').slice(0, 70)}…”`);
  check(/Is it safe/.test(await page.locator('.p-plan').innerText()), 'today’s plan includes the “Is it safe?” checks');
  const focus = await page.locator('.p-focus').innerText();
  check(/most common mistake: moved a piece where it could be taken/i.test(focus), 'what to work on: your most common mistake from Quick Reviews');
  check(/Slow down/.test(focus) && /80% of your rapid moves/.test(focus), 'what to work on: slow down, with your numbers');

  await page.goto(`${URL}#/games/${USER}?game=${encodeURIComponent(GAMES[5].url)}`);
  const line = page.locator('.clock-line');
  await line.waitFor({ timeout: 120000 });
  check(/You used 2\.1 of 10 min/.test(await line.innerText()) && /16 of 20 moves in under 5 seconds/.test(await line.innerText()), `the game report shows your clock: “${(await line.innerText()).trim()}”`);

  if (errors.length) {
    failed += errors.length;
    console.log(`  ✗ page errors: ${errors.join(' | ')}`);
  }
  await browser.close();
}
console.log(failed ? `\n${failed} failure(s)` : '\nClock and tilt coach OK');
process.exit(failed ? 1 : 0);
