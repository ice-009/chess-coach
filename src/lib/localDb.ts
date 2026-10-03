// Talks to the on-device master database (src/lib/localDb.worker.ts). Used on the hosted site, which has no server.
import type { LocalDbReply, LocalDbRequest } from './localDb.worker';

// set once a database has been imported, so pages can skip starting SQLite on devices that have none
const MARKER = 'cc-local-db';
const hasMarker = () => {
  try {
    return localStorage.getItem(MARKER) === '1';
  } catch {
    return false;
  }
};
const setMarker = (on: boolean) => {
  try {
    if (on) localStorage.setItem(MARKER, '1');
    else localStorage.removeItem(MARKER);
  } catch {
    // private mode: the worker is simply asked every time
  }
};

export interface LocalStatus {
  ready: boolean;
  meta: Record<string, string> | null;
  bytes: number;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; progress?: (p: number) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./localDb.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<LocalDbReply>) => {
      const r = e.data;
      const p = pending.get(r.id);
      if (!p) return;
      if ('progress' in r) return p.progress?.(r.progress);
      pending.delete(r.id);
      if (r.ok) p.resolve(r.result);
      else p.reject(new Error(r.error));
    };
  }
  return worker;
}

type Request = LocalDbRequest extends infer R ? (R extends unknown ? Omit<R, 'id'> : never) : never;

function call<T>(msg: Request, progress?: (p: number) => void): Promise<T> {
  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, progress });
    getWorker().postMessage({ ...msg, id });
  });
}

/** Whether this device has a database, without loading SQLite when it never had one. */
export async function localStatus(): Promise<LocalStatus> {
  if (!hasMarker()) return { ready: false, meta: null, bytes: 0 };
  const st = await call<LocalStatus>({ type: 'status' });
  if (!st.ready) setMarker(false); // the browser cleared its storage
  return st;
}

export async function importLocalDb(file: File, onProgress: (p: number) => void): Promise<LocalStatus> {
  const st = await call<LocalStatus>({ type: 'import', file }, onProgress);
  setMarker(st.ready);
  // ask the browser not to clear it when space runs low (granted for Home Screen apps and frequently used sites)
  await navigator.storage?.persist?.().catch(() => false);
  return st;
}

export async function removeLocalDb(): Promise<void> {
  await call({ type: 'remove' });
  setMarker(false);
}

export const localQuery = (route: string, params: string, body?: unknown) => call<[number, unknown]>({ type: 'query', route, params, body });
