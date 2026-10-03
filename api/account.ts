// Accounts and progress sync: a Vercel function at /api/account on the hosted app; the Mac app serves the same
// handler through Vite (server/accountsDev.ts). Username + password, no email.
//   GET  ?op=me                      who is signed in
//   POST ?op=signup | login          { username, password }
//   POST ?op=logout
//   POST ?op=password                { current, next }
//   POST ?op=delete                  { password }
//   GET  ?op=sync                    { data, rev }
//   PUT  ?op=sync                    { data, baseRev }  → 409 with the newer copy if another device synced first
// Security: passwords are hashed with scrypt and a random salt; the session is a random token in an HttpOnly,
// Secure, SameSite=Lax cookie and only its SHA-256 is stored; same-origin only (no CORS headers), and every
// state change must be a JSON request whose Origin matches; logins and sign-ups are rate limited.
// Self-contained (Node built-ins only) so it deploys as a single function.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';

export interface Store {
  get(key: string): Promise<string | null>;
  /** Returns false when `nx` is set and the key already exists. */
  set(key: string, value: string, opts?: { ex?: number; nx?: boolean }): Promise<boolean>;
  del(key: string): Promise<void>;
  /** Increments a counter that expires `ex` seconds after it was first created. */
  incr(key: string, ex: number): Promise<number>;
  expire(key: string, ex: number): Promise<void>;
}

/** Upstash Redis over its REST API (the Vercel integration sets the URL and token). */
export function upstashStore(url: string, token: string): Store {
  const cmd = async (...args: (string | number)[]) => {
    const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(args) });
    const body = (await res.json()) as { result?: unknown; error?: string };
    if (body.error) throw new Error(body.error);
    return body.result;
  };
  return {
    get: async (k) => (await cmd('GET', k)) as string | null,
    set: async (k, v, o = {}) => (await cmd('SET', k, v, ...(o.ex ? ['EX', o.ex] : []), ...(o.nx ? ['NX'] : []))) === 'OK',
    del: async (k) => void (await cmd('DEL', k)),
    incr: async (k, ex) => {
      const n = (await cmd('INCR', k)) as number;
      if (n === 1) await cmd('EXPIRE', k, ex);
      return n;
    },
    expire: async (k, ex) => void (await cmd('EXPIRE', k, ex)),
  };
}

/** In-memory store with expiry (local development and tests); `onChange` can persist it. */
export function memoryStore(initial: Record<string, { v: string; exp?: number }> = {}, onChange?: (all: Record<string, { v: string; exp?: number }>) => void): Store {
  const data = initial;
  const live = (k: string) => {
    const e = data[k];
    if (e?.exp && e.exp < Date.now()) delete data[k];
    return data[k];
  };
  const changed = () => onChange?.(data);
  return {
    get: async (k) => live(k)?.v ?? null,
    set: async (k, v, o = {}) => {
      if (o.nx && live(k)) return false;
      data[k] = { v, exp: o.ex ? Date.now() + o.ex * 1000 : undefined };
      changed();
      return true;
    },
    del: async (k) => {
      delete data[k];
      changed();
    },
    incr: async (k, ex) => {
      const e = live(k);
      const n = (e ? Number(e.v) : 0) + 1;
      data[k] = { v: String(n), exp: e?.exp ?? Date.now() + ex * 1000 };
      changed();
      return n;
    },
    expire: async (k, ex) => {
      if (live(k)) data[k].exp = Date.now() + ex * 1000;
      changed();
    },
  };
}

const COOKIE = 'cc_session';
const SESSION_SECONDS = 30 * 24 * 3600;
const USERNAME = /^[A-Za-z0-9_-]{3,20}$/;
const MAX_SYNC_BYTES = 512 * 1024;

interface User {
  username: string; // as typed at sign-up
  salt: string;
  hash: string;
  created: number;
  /** Sessions started before this (a password change) are no longer valid. */
  validAfter?: number;
}

function scrypt(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCb(password.normalize('NFKC'), salt, 64, { N: 16384, r: 8, p: 1 }, (e, key) => (e ? reject(e) : resolve(key))));
}
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return { salt, hash: (await scrypt(password, salt)).toString('hex') };
}
async function verifyPassword(user: User | null, password: string): Promise<boolean> {
  // hash even for unknown users, so response times don't reveal which usernames exist
  const key = await scrypt(password, user?.salt ?? 'no-such-user-salt');
  return !!user && timingSafeEqual(key, Buffer.from(user.hash, 'hex'));
}
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function json(status: number, data: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
}
const cookie = (value: string, maxAge: number, secure: boolean) => `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
const publicUser = (u: User) => ({ username: u.username, created: u.created });

export async function handle(req: Request, store: Store): Promise<Response> {
  const url = new URL(req.url);
  const op = url.searchParams.get('op') ?? '';
  const secure = url.protocol === 'https:';
  const ip = (req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'local').split(',')[0].trim();

  if (req.method !== 'GET') {
    const origin = req.headers.get('origin');
    if (origin && origin !== url.origin) return json(403, { error: 'This request has to come from the app itself.' });
    if (!(req.headers.get('content-type') ?? '').includes('application/json')) return json(415, { error: 'Expected JSON.' });
  }
  let body: Record<string, unknown> = {};
  if (req.method === 'POST' || req.method === 'PUT') {
    const text = await req.text();
    if (text.length > MAX_SYNC_BYTES + 1024) return json(413, { error: 'Too much data.' });
    try {
      body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return json(400, { error: 'Bad request.' });
    }
  }

  // the signed-in user, if any
  const token = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})`))?.[1];
  const sessionKey = token ? `session:${sha256(token)}` : null;
  const session = sessionKey ? (JSON.parse((await store.get(sessionKey)) ?? 'null') as { u: string; t: number; c: number } | null) : null;
  const owner = session ? (JSON.parse((await store.get(`user:${session.u}`)) ?? 'null') as User | null) : null;
  const user = owner && session && (session.c ?? 0) >= (owner.validAfter ?? 0) ? owner : null;

  async function startSession(name: string): Promise<string> {
    const t = randomBytes(32).toString('hex');
    await store.set(`session:${sha256(t)}`, JSON.stringify({ u: name.toLowerCase(), t: Date.now(), c: Date.now() }), { ex: SESSION_SECONDS });
    return cookie(t, SESSION_SECONDS, secure);
  }
  const tooMany = () => json(429, { error: 'Too many attempts. Wait 15 minutes and try again.' });

  switch (`${req.method} ${op}`) {
    case 'GET me': {
      if (!user || !sessionKey) return json(401, { user: null });
      if (Date.now() - session!.t > 24 * 3600 * 1000) {
        // sliding expiry: active users stay signed in
        await store.set(sessionKey, JSON.stringify({ ...session, t: Date.now() }), { ex: SESSION_SECONDS });
      }
      return json(200, { user: publicUser(user) });
    }

    case 'POST signup': {
      const username = String(body.username ?? '').trim();
      const password = String(body.password ?? '');
      if (!USERNAME.test(username)) return json(400, { error: 'Usernames are 3 to 20 letters, digits, - or _.' });
      if (password.length < 8 || password.length > 200) return json(400, { error: 'Use a password of at least 8 characters.' });
      if ((await store.incr(`rl:signup:${ip}`, 3600)) > 10) return tooMany();
      const { salt, hash } = await hashPassword(password);
      const created: User = { username, salt, hash, created: Date.now() };
      if (!(await store.set(`user:${username.toLowerCase()}`, JSON.stringify(created), { nx: true }))) return json(409, { error: 'That username is taken.' });
      return json(201, { user: publicUser(created) }, { 'Set-Cookie': await startSession(username) });
    }

    case 'POST login': {
      const username = String(body.username ?? '').trim();
      const password = String(body.password ?? '');
      if ((await store.incr(`rl:login:ip:${ip}`, 900)) > 30 || (await store.incr(`rl:login:user:${username.toLowerCase()}`, 900)) > 10) return tooMany();
      const found = USERNAME.test(username) ? (JSON.parse((await store.get(`user:${username.toLowerCase()}`)) ?? 'null') as User | null) : null;
      if (!(await verifyPassword(found, password))) return json(401, { error: 'Wrong username or password.' });
      await store.del(`rl:login:user:${username.toLowerCase()}`);
      return json(200, { user: publicUser(found!) }, { 'Set-Cookie': await startSession(found!.username) });
    }

    case 'POST logout': {
      if (sessionKey) await store.del(sessionKey);
      return json(200, { ok: true }, { 'Set-Cookie': cookie('', 0, secure) });
    }

    case 'POST password': {
      if (!user) return json(401, { error: 'Sign in first.' });
      const next = String(body.next ?? '');
      if (!(await verifyPassword(user, String(body.current ?? '')))) return json(401, { error: 'Your current password is wrong.' });
      if (next.length < 8 || next.length > 200) return json(400, { error: 'Use a password of at least 8 characters.' });
      // signs out every other device; this one gets a fresh session
      await store.set(`user:${user.username.toLowerCase()}`, JSON.stringify({ ...user, ...(await hashPassword(next)), validAfter: Date.now() }));
      if (sessionKey) await store.del(sessionKey);
      return json(200, { ok: true }, { 'Set-Cookie': await startSession(user.username) });
    }

    case 'POST delete': {
      if (!user || !sessionKey) return json(401, { error: 'Sign in first.' });
      if (!(await verifyPassword(user, String(body.password ?? '')))) return json(401, { error: 'Wrong password.' });
      const name = user.username.toLowerCase();
      await store.del(`user:${name}`);
      await store.del(`progress:${name}`);
      await store.del(sessionKey);
      return json(200, { ok: true }, { 'Set-Cookie': cookie('', 0, secure) });
    }

    case 'GET sync': {
      if (!user) return json(401, { error: 'Sign in first.' });
      const saved = JSON.parse((await store.get(`progress:${user.username.toLowerCase()}`)) ?? 'null') as { data: unknown; rev: number } | null;
      return json(200, saved ?? { data: {}, rev: 0 });
    }

    case 'PUT sync': {
      if (!user) return json(401, { error: 'Sign in first.' });
      const key = `progress:${user.username.toLowerCase()}`;
      const saved = JSON.parse((await store.get(key)) ?? 'null') as { data: unknown; rev: number } | null;
      const rev = saved?.rev ?? 0;
      if (Number(body.baseRev ?? -1) !== rev) return json(409, saved ?? { data: {}, rev: 0 }); // another device synced first
      const next = JSON.stringify({ data: body.data ?? {}, rev: rev + 1 });
      if (next.length > MAX_SYNC_BYTES) return json(413, { error: 'Too much data to sync.' });
      await store.set(key, next);
      return json(200, { rev: rev + 1 });
    }

    default:
      return json(404, { error: 'Unknown request.' });
  }
}

// ── Vercel entry points (Web-standard handlers on the Node.js runtime) ──
function productionStore(): Store | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? upstashStore(url, token) : null;
}
async function route(req: Request): Promise<Response> {
  const store = productionStore();
  if (!store) return json(503, { error: 'Accounts aren’t set up on this server yet.' });
  try {
    return await handle(req, store);
  } catch (e) {
    console.error('[account]', e);
    return json(500, { error: 'Something went wrong. Try again.' });
  }
}
export const GET = route;
export const POST = route;
export const PUT = route;
