// The account server's rules, without a browser: sign-up and login, rate limits, same-origin checks,
// sync conflicts, password changes signing out other devices, and deleted accounts' leftover sessions.
// Usage: npm run test:account-api
import { handle, memoryStore } from '../api/account.ts';
const store = memoryStore();
let cookie = '';
const call = async (method: string, op: string, body?: unknown, extra: Record<string, string> = {}) => {
  const r = await handle(new Request(`https://app.test/api/account?op=${op}`, { method, headers: { 'content-type': 'application/json', origin: 'https://app.test', cookie, ...extra }, body: body ? JSON.stringify(body) : undefined }), store);
  const sc = r.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  return { status: r.status, body: await r.json(), sc };
};
let failed = 0;
const ok = (c: boolean, m: string) => {
  console.log(c ? '✓' : '✗', m);
  if (!c) failed++;
};
ok((await call('GET', 'me')).status === 401, 'me signed out → 401');
const su = await call('POST', 'signup', { username: 'Armaan_06', password: 'hunter22x' });
ok(su.status === 201 && /HttpOnly; SameSite=Lax; Max-Age=2592000; Secure/.test(su.sc!), 'signup sets secure HttpOnly cookie');
ok((await call('GET', 'me')).body.user.username === 'Armaan_06', 'me returns username');
ok((await call('POST', 'signup', { username: 'armaan_06', password: 'xxxxxxxx' })).status === 409, 'username taken (case-insensitive)');
ok((await call('POST', 'signup', { username: 'a', password: 'xxxxxxxx' })).status === 400, 'bad username rejected');
ok((await call('POST', 'login', {}, { origin: 'https://evil.test' })).status === 403, 'cross-origin POST blocked');
ok((await call('POST', 'login', {}, { 'content-type': 'text/plain' })).status === 415, 'non-JSON POST blocked');
const s1 = await call('PUT', 'sync', { data: { a: 1 }, baseRev: 0 });
ok(s1.body.rev === 1, 'first sync rev 1');
const s2 = await call('PUT', 'sync', { data: { a: 2 }, baseRev: 0 });
ok(s2.status === 409 && s2.body.data.a === 1, 'stale sync → 409 with newer copy');
ok((await call('GET', 'sync')).body.data.a === 1, 'sync get');
await call('POST', 'logout');
ok((await call('GET', 'me')).status === 401, 'logout clears session');
ok((await call('POST', 'login', { username: 'ARMAAN_06', password: 'wrong-pass' })).body.error === 'Wrong username or password.', 'wrong password generic error');
ok((await call('POST', 'login', { username: 'nobody', password: 'wrong-pass' })).body.error === 'Wrong username or password.', 'unknown user same error');
const li = await call('POST', 'login', { username: 'armaan_06', password: 'hunter22x' });
ok(li.status === 200 && li.body.user.username === 'Armaan_06', 'login any case');
ok((await call('POST', 'password', { current: 'hunter22x', next: 'newpass123' })).status === 200, 'change password');
for (let i = 0; i < 10; i++) await call('POST', 'login', { username: 'victim', password: 'guess' + i });
ok((await call('POST', 'login', { username: 'victim', password: 'x' })).status === 429, 'per-user rate limit');
ok((await call('POST', 'delete', { password: 'newpass123' })).status === 200, 'delete account');
ok((await call('POST', 'login', { username: 'armaan_06', password: 'newpass123' })).status === 401, 'deleted account cannot log in');
// password change signs out other devices
cookie = '';
await call('POST', 'signup', { username: 'twodev', password: 'password1' });
const devA = cookie;
cookie = '';
await call('POST', 'login', { username: 'twodev', password: 'password1' });
const devB = cookie;
await new Promise((r) => setTimeout(r, 5));
cookie = devA;
ok((await call('POST', 'password', { current: 'password1', next: 'password2' })).status === 200, 'device A changes password');
ok((await call('GET', 'me')).status === 200, 'device A still signed in');
cookie = devB;
ok((await call('GET', 'me')).status === 401, 'device B signed out');
// a deleted account's leftover sessions must not open a new account with the same name
cookie = '';
await call('POST', 'signup', { username: 'reuse_me', password: 'password1' });
const oldPhone = cookie;
cookie = '';
await call('POST', 'login', { username: 'reuse_me', password: 'password1' });
await call('POST', 'delete', { password: 'password1' }); // deleted from the laptop; the phone's session is left
await new Promise((r) => setTimeout(r, 5));
cookie = '';
await call('POST', 'signup', { username: 'reuse_me', password: 'someone-else' });
cookie = oldPhone;
ok((await call('GET', 'me')).status === 401, 'old session of a deleted account does not open a new account with the same name');
ok((await call('GET', 'sync')).status === 401, '…nor its progress');
if (failed) console.log(`\n${failed} failure(s)`);
else console.log('\nAccount server OK');
process.exit(failed ? 1 : 0);
