// Layout check on laptop, iPad and phone sizes: no sideways scrolling anywhere, and on laptops and iPads every
// board a page is built around fits on screen. Screenshots go to test-results/layout/.
// Usage: npm run test:layout [-- <app url> [device,device…]]   (default http://localhost:5173/, all devices)
// Needs the app running (npm run dev / npm start) and Playwright browsers (npx playwright-core install webkit).
import { chromium, devices, webkit } from 'playwright-core';
import fs from 'node:fs';

const URL = process.argv[2] || 'http://localhost:5173/';
const ONLY = process.argv[3]?.split(',');
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
// iPad Air 11": the real visible area in Safari (status bar + toolbar subtracted)
const DEVICES = [
  { name: 'laptop-1440', engine: chromium, fit: true, opts: { viewport: { width: 1440, height: 900 } } },
  { name: 'laptop-1366', engine: chromium, fit: true, opts: { viewport: { width: 1366, height: 768 } } },
  { name: 'ipad-landscape', engine: webkit, fit: true, opts: { viewport: { width: 1180, height: 740 }, isMobile: true, hasTouch: true, userAgent: IPAD } },
  { name: 'ipad-portrait', engine: webkit, fit: true, opts: { viewport: { width: 820, height: 1100 }, isMobile: true, hasTouch: true, userAgent: IPAD } },
  { name: 'iphone', engine: webkit, fit: false, opts: devices['iPhone 15'] },
  { name: 'android', engine: chromium, fit: false, opts: devices['Pixel 7'] },
];
// [route, element the page is built around, must it fit on laptop/iPad screens?]
const PAGES = [
  ['', '.dash .next-up', false],
  ['account', '.auth-card, .acc-head, .empty', false],
  ['learn', '.lesson-list', false],
  ['learn/opening-rules', '.lesson .board-box', false],
  ['openings', '.card', false],
  ['openings?view=encyclopedia', '.card', false],
  ['openings/enc-ruy/enc-ruy-closed', '.op-board .board-box', true],
  ['openings/enc-najdorf/enc-najdorf-english?mode=drill', '.op-board .board-box', true],
  ['openings/quiz?scope=repertoire', '.quiz-setup', false],
  ['openings/quiz?scope=enc-ruy&color=w', '.quiz-round .board-box', true],
  ['train', '.puzzle-board .board-box', true],
  ['train/endgames', '.puzzle-board .board-box', true],
  ['train/mates', '.puzzle-board .board-box', true],
  ['practice', '.level-card', false],
  ['practice/drills', '.card', false],
  ['practice/drill/two-bishops', '.puzzle-board .board-box', true],
  ['practice/vision', '.vision-board .board-box', true],
  ['explore', '.analysis .board-box', true],
  ['masters', '.card', false],
  ['database', '.mx-table, .device-db, .db-setup', false],
  ['offline', '.offline-page, .page-head', false],
];

let failures = 0;
fs.mkdirSync('test-results/layout', { recursive: true });
for (const d of DEVICES.filter((x) => !ONLY || ONLY.includes(x.name))) {
  // Chromium devices use the installed Google Chrome when Playwright's own Chromium isn't downloaded
  const browser = d.engine === chromium ? await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' })) : await webkit.launch();
  const page = await (await browser.newContext({ ...d.opts, deviceScaleFactor: 1 })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const report = [];
  for (const [route, selector, mustFit] of PAGES) {
    await page.goto(URL + '#/' + route);
    try {
      await page.waitForSelector(selector, { timeout: 30000 });
    } catch {
      report.push(`  ✗ ${route}: did not load`);
      failures++;
      continue;
    }
    await page.waitForTimeout(800);
    const m = await page.evaluate((sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth - innerWidth, bottom: Math.round(r.bottom + scrollY), height: innerHeight };
    }, selector);
    const problems = [];
    if (m.overflow > 0) problems.push(`scrolls sideways by ${m.overflow}px`);
    if (d.fit && mustFit && m.bottom > m.height) problems.push(`board ends at ${m.bottom}px, screen is ${m.height}px`);
    if (problems.length) failures++;
    report.push(`  ${problems.length ? '✗' : '✓'} ${route || 'home'}${problems.length ? ': ' + problems.join(', ') : ''}`);
    await page.screenshot({ path: `test-results/layout/${d.name}-${(route || 'home').replace(/[/?=]/g, '_')}.png` });
  }
  if (errors.length) {
    failures += errors.length;
    report.push(`  ✗ page errors: ${errors.join(' | ')}`);
  }
  console.log(`${d.name}\n${report.join('\n')}`);
  await browser.close();
}
console.log(failures ? `\n${failures} problem(s)` : '\nAll layouts OK');
process.exit(failures ? 1 : 0);
