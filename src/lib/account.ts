// Your account: who is signed in, and keeping progress in step with the server (/api/account).
// Progress always lives on the device first, so everything works offline; when signed in, changes are uploaded
// a few seconds after they happen and other devices' changes are merged in when the app opens or comes back.
// The session itself is an HttpOnly cookie the page can't read; only the username is remembered here.
import { useSyncExternalStore } from 'react';
import { load, onSave, save } from './storage';
import { SYNCED, mergeDocs } from './sync';
import type { SyncDoc } from './sync';

export interface User {
  username: string;
  created: number;
}
export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
export interface AccountState {
  status: 'loading' | 'signedOut' | 'signedIn' | 'unavailable';
  user: User | null;
  sync: SyncState;
  lastSync: number;
}

const ACCOUNT = 'cca-account'; // { username, created } of the signed-in user, for offline starts
const LAST_USER = 'cca-last-user'; // prefills the sign-in form
const SYNC = 'cca-sync'; // { rev, times, dirty, last }

interface SyncMeta {
  rev: number;
  times: Record<string, number>;
  dirty: boolean;
  last: number;
  owner?: string; // the account this device's progress was last synced with
}
const meta = (): SyncMeta => ({ rev: 0, times: {}, dirty: false, last: 0, ...load<Partial<SyncMeta>>(SYNC, {}) });
const writeMeta = (m: SyncMeta) => {
  try {
    localStorage.setItem(SYNC, JSON.stringify(m));
  } catch {
    // storage blocked
  }
};

// ── state ──
let state: AccountState = { status: 'loading', user: load<User | null>(ACCOUNT, null), sync: 'idle', lastSync: meta().last };
const subs = new Set<() => void>();
function set(patch: Partial<AccountState>) {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
export const useAccount = () => useSyncExternalStore(subscribe, () => state);
export const lastUsername = () => load<string>(LAST_USER, '');

// ── server calls ──
export class AccountError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
async function api<T>(method: 'GET' | 'POST' | 'PUT', op: string, body?: unknown): Promise<{ status: number; data: T }> {
  let res: Response;
  try {
    res = await fetch(`/api/account?op=${op}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new AccountError('You’re offline. Connect to the internet and try again.', 0);
  }
  // a host without the accounts function answers with the app page or a 404
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) throw new AccountError('Accounts aren’t available on this version of the app.', 503);
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok && res.status !== 409) throw new AccountError(data.error ?? 'Something went wrong. Try again.', res.status);
  return { status: res.status, data };
}

function signedIn(user: User) {
  save(LAST_USER, user.username);
  try {
    localStorage.setItem(ACCOUNT, JSON.stringify(user));
  } catch {
    // storage blocked
  }
  set({ status: 'signedIn', user });
}

function clearProgress() {
  try {
    for (const key of [...SYNCED, SYNC]) localStorage.removeItem(key);
  } catch {
    // storage blocked
  }
  window.dispatchEvent(new Event('cca-synced'));
}

/** Removes this device's copy of the account's progress (after signing out or deleting the account). */
function forgetLocal() {
  clearProgress();
  try {
    localStorage.removeItem(ACCOUNT);
  } catch {
    // storage blocked
  }
  set({ status: 'signedOut', user: null, sync: 'idle', lastSync: 0 });
}

// ── sync ──
function localDoc(m: SyncMeta): SyncDoc {
  const doc: SyncDoc = {};
  for (const key of SYNCED) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) doc[key] = { v: JSON.parse(raw), t: m.times[key] ?? 0 };
    } catch {
      // unreadable value: leave it out
    }
  }
  return doc;
}
const same = (a: SyncDoc, b: SyncDoc) => SYNCED.every((k) => JSON.stringify(a[k] ?? null) === JSON.stringify(b[k] ?? null));

let changes = 0; // local changes since the page opened
let running = false;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Merges the account's progress into this device and uploads anything new. */
export async function syncNow(): Promise<void> {
  if (state.status !== 'signedIn') return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  set({ sync: 'syncing' });
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const m = meta();
      const { data: server } = await api<{ data: { keys?: SyncDoc }; rev: number }>('GET', 'sync');
      const remote = server.data?.keys ?? {};
      const seen = changes;
      const merged = mergeDocs(localDoc(m), remote);
      // write what other devices added (straight to storage, so it doesn't count as a new local change)
      let changedHere = false;
      for (const key of SYNCED) {
        if (!merged[key]) continue;
        const raw = JSON.stringify(merged[key].v);
        if (localStorage.getItem(key) !== raw) {
          localStorage.setItem(key, raw);
          changedHere = true;
        }
        m.times[key] = merged[key].t;
      }
      if (changedHere) window.dispatchEvent(new Event('cca-synced'));
      let rev = server.rev;
      if (!same(merged, remote)) {
        const put = await api<{ rev: number }>('PUT', 'sync', { data: { v: 1, keys: merged }, baseRev: server.rev });
        if (put.status === 409) continue; // another device synced in between: merge again
        rev = put.data.rev;
      }
      writeMeta({ ...meta(), rev, times: { ...meta().times, ...m.times }, dirty: changes !== seen, last: Date.now(), owner: state.user?.username.toLowerCase() });
      set({ sync: 'synced', lastSync: Date.now() });
      return;
    }
    set({ sync: 'error' });
  } catch (e) {
    if (e instanceof AccountError && e.status === 401) forgetSession();
    else set({ sync: e instanceof AccountError && e.status === 0 ? 'offline' : 'error' });
  } finally {
    running = false;
    if (again) {
      again = false;
      schedule(500);
    }
  }
}

function schedule(ms = 2500) {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), ms);
}

/** The session ended elsewhere (password changed on another device, or it expired). */
function forgetSession() {
  try {
    localStorage.removeItem(ACCOUNT);
  } catch {
    // storage blocked
  }
  set({ status: 'signedOut', user: null, sync: 'idle' });
}

// every change to synced progress is timestamped (signed in or not), and uploaded when signed in
onSave((key) => {
  if (!SYNCED.includes(key)) return;
  const m = meta();
  m.times[key] = Date.now();
  m.dirty = true;
  writeMeta(m);
  changes++;
  if (state.status === 'signedIn') schedule();
});

// ── account actions ──
async function start(op: 'signup' | 'login', username: string, password: string) {
  const { data } = await api<{ user: User }>('POST', op, { username, password });
  // progress left here by someone else's account (their session ended without signing out) isn't yours
  const owner = meta().owner;
  if (owner && owner !== data.user.username.toLowerCase()) clearProgress();
  signedIn(data.user);
  await syncNow(); // anything already on this device joins the account
}
export const signUp = (username: string, password: string) => start('signup', username, password);
export const signIn = (username: string, password: string) => start('login', username, password);

/** Uploads the last changes, ends the session and removes the account's progress from this device. */
export async function signOut(): Promise<void> {
  while (running) await new Promise((r) => setTimeout(r, 100));
  await syncNow();
  if (meta().dirty && state.sync !== 'synced') throw new AccountError('Your latest progress hasn’t been saved to your account yet. Connect to the internet and try again.', 0);
  await api('POST', 'logout');
  forgetLocal();
}

export async function changePassword(current: string, next: string): Promise<void> {
  await api('POST', 'password', { current, next });
}

export async function deleteAccount(password: string): Promise<void> {
  await api('POST', 'delete', { password });
  forgetLocal();
}

// ── start-up: check the session, then keep in step while the app is open ──
let started = false;
export function startAccount() {
  if (started) return;
  started = true;
  api<{ user: User | null }>('GET', 'me')
    .then(({ data }) => {
      signedIn(data.user!);
      void syncNow();
    })
    .catch((e: AccountError) => {
      if (e.status === 401) forgetSession();
      else if (e.status === 0 && state.user) set({ status: 'signedIn', sync: 'offline' }); // offline: carry on as before
      else if (e.status === 0) set({ status: 'signedOut' });
      else set({ status: e.status === 503 || e.status === 404 ? 'unavailable' : 'signedOut' });
    });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.status === 'signedIn' && Date.now() - state.lastSync > 30_000) void syncNow();
    if (document.visibilityState === 'hidden' && state.status === 'signedIn' && meta().dirty) flush();
  });
  window.addEventListener('online', () => {
    if (state.status === 'signedIn') void syncNow();
  });
}

/** Leaving the app: upload unsent changes in the background (small enough for a keepalive request). */
function flush() {
  const m = meta();
  const body = JSON.stringify({ data: { v: 1, keys: localDoc(m) }, baseRev: m.rev });
  if (body.length > 60_000) return; // the next start syncs it
  try {
    void fetch('/api/account?op=sync', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body, keepalive: true, credentials: 'same-origin' });
  } catch {
    // ignore
  }
}
