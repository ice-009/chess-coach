// The board feels like chess.com: legal-move dots and capture rings (on click and while dragging), the last move
// highlighted, a red glow on a king in check, a promotion picker, a sound for each kind of move (checked through
// <html data-last-sound>), player bars with captured pieces against the computer, right/wrong sounds in
// exercises and the sound switch. Runs in Chrome and in WebKit (Safari's engine) at iPad size.
// Usage: npm run test:board [-- <app url>]   (the app must be running)
import { chromium, webkit } from 'playwright-core';

const URL = process.argv[2] || 'http://localhost:5173/';
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
  const sq = (s) => page.locator(`.board-box [data-square="${s}"]`).first();
  const style = (s) => sq(s).evaluate((el) => [el, ...el.querySelectorAll('*')].map((n) => `${getComputedStyle(n).backgroundImage} ${getComputedStyle(n).background}`).join(' | '));
  const lastSound = () => page.evaluate(() => document.documentElement.dataset.lastSound);
  const lastMove = () => page.locator('.board-box').first().getAttribute('data-last-move');
  const fen = () => page.locator('.board-box').first().getAttribute('data-fen');
  async function clickMove(from, to) {
    await sq(from).click();
    await sq(to).click();
    await page.waitForTimeout(250);
  }
  const open = async (f) => {
    await page.goto(`${URL}#/explore?fen=${encodeURIComponent(f)}`);
    await page.waitForSelector('.board-box [data-square="e1"]');
    await page.waitForTimeout(300);
  };

  // dots and rings
  await open('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
  await sq('e4').click();
  check(/radial-gradient/.test(await style('e5')), 'clicking a piece shows a dot on its legal squares');
  check(/radial-gradient\(circle, (rgba\(0, 0, 0, 0\)|transparent) 72%/.test(await style('d5')), 'a capture square shows a ring');
  await sq('d5').click();
  await page.waitForTimeout(250);
  check((await lastSound()) === 'capture', `capture sound (${await lastSound()})`);
  check((await lastMove()) === 'e4d5', 'the last move is highlighted');

  // castle
  await open('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
  await clickMove('e1', 'g1');
  check((await lastSound()) === 'castle', `castling sound (${await lastSound()})`);

  // check, and the red glow
  await open('4k3/8/8/8/8/8/3Q4/4K3 w - - 0 1');
  await clickMove('d2', 'd7');
  check((await lastSound()) === 'check', `check sound (${await lastSound()})`);
  check(/radial-gradient/.test(await style('e8')) && /255, 0, 0|231, 0, 0/.test(await style('e8')), 'the king in check glows red');

  // drag shows dots, and a drag makes the move
  await open('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  if (engine === chromium) {
    const a = await sq('g1').boundingBox();
    const b = await sq('f3').boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 - 10, { steps: 4 });
    check(/radial-gradient/.test(await style('f3')), 'dragging a piece shows its legal squares');
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    check((await fen()).startsWith('rnbqkbnr/pppppppp/8/8/8/5N2'), 'drag and drop plays the move');
    check((await lastSound()) === 'move', `move sound (${await lastSound()})`);
  }

  // promotion picker
  await open('8/P7/8/8/8/8/k6p/4K3 w - - 0 1'); // black keeps a pawn, so promoting doesn't end the game
  await sq('a7').click();
  await sq('a8').click();
  check(await page.locator('.promo-column').isVisible(), 'moving a pawn to the last rank opens the piece picker');
  await page.locator('.promo-cancel').click();
  check(!(await page.locator('.promo-column').count()) && (await fen()).startsWith('8/P7'), 'cancelling leaves the pawn where it was');
  await sq('a7').click();
  await sq('a8').click();
  await page.locator('.promo-piece[data-piece="n"]').click();
  await page.waitForTimeout(300);
  check((await fen()).startsWith('N7/'), `choosing a knight promotes to a knight (${(await fen()).split(' ')[0]})`);
  check((await lastSound()) === 'promote', `promotion sound (${await lastSound()})`);

  // playing the computer: bars, captured pieces, thinking dots
  await page.goto(`${URL}#/practice`);
  await page.locator('.btn-green.big', { hasText: 'Play' }).click();
  await page.waitForSelector('.play-bar');
  check((await page.locator('.play-bar').count()) === 2, 'player bars above and below the board');
  const before = Number(await page.evaluate(() => document.documentElement.dataset.soundCount ?? 0));
  await clickMove('e2', 'e4');
  await page.waitForTimeout(2500);
  const after = Number(await page.evaluate(() => document.documentElement.dataset.soundCount ?? 0));
  check(after >= before + 2, `your move and the computer's reply both make a sound (${after - before})`);

  // exercises: right and wrong
  await page.goto(`${URL}#/learn/basic-mates`);
  await page.waitForSelector('.exercise');
  const ex = (s) => page.locator(`.exercise [data-square="${s}"]`).first();
  await ex('a1').click();
  await ex('a2').click();
  await page.waitForTimeout(300);
  check((await lastSound()) === 'wrong', `a wrong answer sounds wrong (${await lastSound()})`);
  await ex('a1').click();
  await ex('a8').click();
  await page.waitForTimeout(600);
  check((await lastSound()) === 'correct', `the right answer sounds right (${await lastSound()})`);

  // the sound switch
  const toggle = page.locator('.sound-toggle.in-rail');
  await toggle.click();
  check((await toggle.getAttribute('aria-pressed')) === 'false' && (await page.evaluate(() => localStorage.getItem('cca-sound'))) === 'off', 'the sound switch turns sounds off and remembers it');
  await toggle.click();

  if (errors.length) {
    failed += errors.length;
    console.log(`  ✗ page errors: ${errors.join(' | ')}`);
  }
  await browser.close();
}
console.log(failed ? `\n${failed} failure(s)` : '\nBoard OK');
process.exit(failed ? 1 : 0);
