// Quick Review end to end, with chess.com's API replaced by a known game (you play Black and allow Scholar's
// mate after 3 seconds): the report offers a quick review, the moment is a find-the-move puzzle (the game move
// is rejected, a good defence accepted), the explanation, rule and time appear, the result is saved, and
// "Show me" works. Runs in Chrome and WebKit. Usage: npm run test:quick [-- <app url>]
import { chromium, webkit } from 'playwright-core';

const URL = process.argv[2] || 'http://localhost:5173/';
const USER = 'quicktester';
const GAME_URL = 'https://www.chess.com/game/live/1';
const PGN = `[Event "Live Chess"]
[White "rival"]
[Black "${USER}"]
[Result "1-0"]
[TimeControl "600"]
[ECOUrl "https://www.chess.com/openings/Kings-Pawn-Opening"]

1. e4 {[%clk 0:09:58]} 1... e5 {[%clk 0:09:55]} 2. Bc4 {[%clk 0:09:50]} 2... Nc6 {[%clk 0:09:49]} 3. Qh5 {[%clk 0:09:45]} 3... Nf6 {[%clk 0:09:46]} 4. Qxf7# {[%clk 0:09:40]} 1-0`;

async function fakeChessCom(page) {
  await page.route('https://api.chess.com/**', (route) => {
    const u = route.request().url();
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.endsWith('/games/archives')) return json({ archives: [`https://api.chess.com/pub/player/${USER}/games/2026/10`] });
    if (u.includes('/games/2026/10'))
      return json({ games: [{ url: GAME_URL, pgn: PGN, time_control: '600', time_class: 'rapid', end_time: 1790000000, rated: true, rules: 'chess', white: { username: 'rival', rating: 760, result: 'win' }, black: { username: USER, rating: 720, result: 'checkmated' } }] });
    if (u.endsWith('/stats')) return json({ chess_rapid: { last: { rating: 720 } } });
    return json({ username: USER });
  });
}

let failed = 0;
const check = (ok, msg) => {
  console.log(`  ${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) failed++;
};

for (const [name, engine, opts] of [
  ['chrome', chromium, { viewport: { width: 1366, height: 860 } }],
  ['webkit (iPad)', webkit, { viewport: { width: 1180, height: 820 }, hasTouch: true }],
]) {
  console.log(name);
  const browser = engine === chromium ? await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' })) : await webkit.launch();
  const page = await browser.newPage(opts);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await fakeChessCom(page);
  const sq = (s) => page.locator(`.board-box [data-square="${s}"]`).first();
  const move = async (from, to) => {
    await sq(from).click();
    await sq(to).click();
  };

  await page.goto(`${URL}#/games/${USER}?game=${encodeURIComponent(GAME_URL)}`);
  const start = page.locator('.quick-start');
  await start.waitFor({ timeout: 120000 }); // the deep analysis finishes first
  check(/1 key moment/.test(await start.innerText()), `the report offers “${await start.innerText()}”`);
  await start.click();
  await page.waitForSelector('.quick-card');
  check((await page.locator('.board-box').getAttribute('data-fen')).startsWith('r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3'), 'the board shows the position before your mistake');
  const context = await page.locator('.quick-context').innerText();
  check(/Nf6/.test(context) && /3 seconds/.test(context), `it says what you played and how fast: “${context.replace(/\s+/g, ' ').slice(0, 90)}…”`);

  await move('g8', 'f6'); // the game move
  await page.waitForSelector('.quick-task.wrong');
  check(/move from the game/.test(await page.locator('.quick-task').innerText()), 'playing the game move again is rejected');
  await move('g7', 'g6'); // the defence
  await page.waitForSelector('.quick-result', { timeout: 30000 });
  check(/You found it/.test(await page.locator('.quick-result').innerText()), 'a good defence is accepted');
  const explain = await page.locator('.quick-explain').innerText();
  check(/checkmate in 1/.test(explain) && /Qxf7#/.test(explain), `the explanation names the threat: “${explain}”`);
  check(/check your opponent could give/.test(await page.locator('.quick-rule').innerText()), 'the habit to take away is shown');
  check(await page.locator('.quick-time').isVisible(), 'the 3-second move is called out');
  await page.locator('.chip', { hasText: 'What happened in the game' }).click();
  await page.waitForSelector('.line-card');
  check(true, 'you can replay what happened in the game');

  await page.locator('.quick-card .btn-green', { hasText: 'Finish' }).click();
  await page.waitForSelector('.quick-summary');
  check(/You found 1 of 1/.test(await page.locator('.quick-summary').innerText()), 'the summary counts what you found');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cca-quick-reviews') ?? '{}'));
  const entry = Object.values(saved)[0];
  check(entry && entry.types.join() === 'allowed-mate' && entry.found === 1, `the result is saved for the dashboard (${JSON.stringify(entry)})`);

  await page.locator('button', { hasText: 'Go through again' }).click();
  await page.waitForSelector('.quick-task');
  await page.locator('.quick-card button', { hasText: 'Show me' }).click();
  await page.waitForSelector('.quick-result.bad');
  check(/The better move was g6/.test(await page.locator('.quick-result').innerText()), '“Show me” reveals the better move');

  if (errors.length) {
    failed += errors.length;
    console.log(`  ✗ page errors: ${errors.join(' | ')}`);
  }
  await browser.close();
}
console.log(failed ? `\n${failed} failure(s)` : '\nQuick Review OK');
process.exit(failed ? 1 : 0);
