// Accounts end to end, with two "devices" (separate browser contexts): sign up keeps the progress already on the
// device, the other device signs in and gets it, changes made on both merge, a password change signs the other
// device out, sign-out removes this device's copy, and the account can be deleted.
// Usage: npm run test:account [-- <app url>]   (the app must be running with its /api/account)
//        ENGINE=webkit npm run test:account     (Safari's engine)
import { chromium, webkit } from 'playwright-core';

const URL = process.argv[2] || 'http://localhost:5173/';
const browser = process.env.ENGINE === 'webkit' ? await webkit.launch() : await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
const user = `e2e_${Date.now().toString(36)}`;
const PASS = 'correct-horse-1';
const NEW_PASS = 'battery-staple-2';
let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) failed++;
};
const errors = [];

async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('dialog', (d) => d.accept());
  if (process.env.DEBUG) {
    page.on('console', (m) => m.type() !== 'log' && !/status of 401/.test(m.text()) && console.log(`  [${name} console] ${m.type()}: ${m.text()}`));
    page.on('response', (r) => r.url().includes('/api/account') && console.log(`  [${name}] ${r.request().method()} ${r.url().split('?')[1]} → ${r.status()}`));
    page.on('requestfailed', (r) => r.url().includes('/api/') && console.log(`  [${name}] failed ${r.url().split('?')[1]}: ${r.failure()?.errorText}`));
  }
  return { ctx, page };
}
const stored = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
const navLabel = (page) => page.locator('.side-account.in-rail .side-label').innerText();
async function signIn(page, username, password, create = false) {
  await page.goto(URL + '#/account');
  await page.waitForSelector('.auth-card');
  await page.locator('.auth-card .seg-tabs button', { hasText: create ? 'Create account' : 'Sign in' }).click();
  await page.fill('#acc-user', username);
  await page.fill('#acc-pass', password);
  await page.locator('.auth-card .btn-green').click();
}
const synced = (page) => page.waitForSelector('.sync-badge.ok', { timeout: 30000 });
/** Runs one complete sync on this device (Sync now) and waits until it has finished. */
async function syncRound(page) {
  await page.goto(URL + '#/account');
  await page.waitForSelector('.acc-head .sync-badge:not(.busy)', { timeout: 30000 }).catch(async (e) => {
    const badge = await page.locator('.sync-badge').first().evaluate((el) => `${el.className}: ${el.textContent}`).catch(() => 'no badge');
    await page.screenshot({ path: 'test-results/account-stuck.png' });
    throw new Error(`sync didn't settle (${badge}; screenshot in test-results/account-stuck.png): ${e.message.split('\n')[0]}`);
  });
  const before = Number(await page.locator('.acc-head .sync-badge').getAttribute('data-last'));
  await page.locator('.acc-sync button', { hasText: 'Sync now' }).click();
  await page.waitForFunction((t) => Number(document.querySelector('.acc-head .sync-badge.ok')?.getAttribute('data-last')) > t, before, { timeout: 30000 });
}
async function finishLesson(page, id) {
  await page.goto(`${URL}#/learn/${id}`);
  await page.locator('.lesson-footer .primary').click();
}

// ── device A: progress made before having an account, then sign up ──
const A = await device('A');
await A.page.goto(URL);
await A.page.waitForSelector('.dash');
await A.page.evaluate(() => {
  localStorage.setItem('cca-lessons-done', JSON.stringify(['blunder-check']));
  localStorage.setItem('cca-rush-best', '7');
  localStorage.setItem('cca-me', JSON.stringify('hikaru'));
});
check((await navLabel(A.page)) === 'Sign in', 'signed out: the sidebar offers “Sign in”');
await signIn(A.page, user, PASS, true);
await A.page.waitForSelector('.dash');
check((await A.page.locator('.dash-head h1').innerText()).includes(user), `after sign-up the dashboard greets ${user}`);
await A.page.goto(URL + '#/account');
await synced(A.page);
check((await navLabel(A.page)) === user, 'the sidebar shows the username');
const cookies = await A.ctx.cookies();
const session = cookies.find((c) => c.name === 'cc_session');
check(!!session && session.httpOnly && session.sameSite === 'Lax' && (session.secure || !URL.startsWith('https:')), 'session cookie is HttpOnly, SameSite=Lax and (on https) Secure');
check(!(await A.page.evaluate(() => document.cookie)).includes('cc_session'), 'page scripts can’t read the session cookie');
check((await A.page.evaluate(() => Object.keys(localStorage).filter((k) => /pass|token|session/i.test(k)).join())) === '', 'no password or token in localStorage');

// ── device B: wrong password, then sign in and receive A's progress ──
const B = await device('B');
await signIn(B.page, user, 'wrong-password');
await B.page.waitForSelector('.auth-card .error');
check((await B.page.locator('.auth-card .error').innerText()) === 'Wrong username or password.', 'wrong password: a generic error');
await signIn(B.page, user.toUpperCase(), PASS);
await B.page.waitForSelector('.dash');
await B.page.waitForTimeout(800);
check(JSON.stringify(await stored(B.page, 'cca-lessons-done')) === '["blunder-check"]', 'device B got the lesson finished on A before sign-up');
check((await stored(B.page, 'cca-me')) === 'hikaru', 'device B remembers the chess.com username');
check((await stored(B.page, 'cca-rush-best')) === 7, 'device B got the Puzzle Rush best');

// ── changes on both devices merge ──
await finishLesson(B.page, 'opening-rules');
await A.page.goto(URL + '#/learn/center-king'); // A works on something else at the same time
await finishLesson(A.page, 'center-king');
await Promise.all([A.page.waitForTimeout(5000), B.page.waitForTimeout(5000)]);
// devices sync whenever they can; one round each, A then B then A, must leave both with everything
await syncRound(A.page);
await syncRound(B.page);
await syncRound(A.page);
const la = (await stored(A.page, 'cca-lessons-done')).sort().join();
const lb = (await stored(B.page, 'cca-lessons-done')).sort().join();
check(la === 'blunder-check,center-king,opening-rules' && la === lb, `lessons from both devices merged on both: ${la} | ${lb}`);

// ── a password change signs the other device out ──
await A.page.fill('#pw-current', PASS);
await A.page.fill('#pw-next', NEW_PASS);
await A.page.locator('button', { hasText: 'Change password' }).click();
await A.page.waitForSelector('text=Password changed');
check(true, 'password changed on A');
await B.page.reload();
await B.page.waitForSelector('.auth-card');
check((await navLabel(B.page)) === 'Sign in', 'device B was signed out by the password change');
check((await B.page.inputValue('#acc-user')) === user, 'the sign-in form remembers the username');
await signIn(B.page, user, NEW_PASS);
await B.page.waitForSelector('.dash');
check((await navLabel(B.page)) === user, 'device B signs in with the new password');
await A.page.reload();
await A.page.waitForSelector('.acc-head');
check((await navLabel(A.page)) === user, 'device A stays signed in after changing the password');

// ── sign out removes this device's copy ──
await A.page.locator('.acc-out button').click();
await A.page.waitForSelector('.dash');
await A.page.waitForTimeout(300);
check((await stored(A.page, 'cca-lessons-done')) === null, 'sign-out removed the progress from device A');
check((await navLabel(A.page)) === 'Sign in', 'device A is signed out');
check(!(await A.ctx.cookies()).some((c) => c.name === 'cc_session' && c.value), 'the session cookie is gone');

// ── delete the account ──
await B.page.goto(URL + '#/account');
await B.page.locator('.danger summary').click();
await B.page.fill('#del-pass', NEW_PASS);
await B.page.locator('.btn-danger').click();
await B.page.waitForSelector('.dash');
await signIn(A.page, user, NEW_PASS);
await A.page.waitForSelector('.auth-card .error');
check(/Wrong username or password/.test(await A.page.locator('.auth-card .error').innerText()), 'the deleted account can’t sign in');

if (errors.length) {
  failed += errors.length;
  console.log(`✗ page errors: ${errors.join(' | ')}`);
}
await browser.close();
console.log(failed ? `\n${failed} failure(s)` : '\nAccounts OK');
process.exit(failed ? 1 : 0);
