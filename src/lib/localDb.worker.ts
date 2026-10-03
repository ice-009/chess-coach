// The master database on this device: SQLite compiled to WebAssembly, reading a copy of masters.db kept in the
// browser's private file storage (OPFS). It runs in a worker because OPFS sync access is worker-only and
// queries block. Nothing is uploaded anywhere: the file comes from the device itself (e.g. the Files app).
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { Database, SAHPoolUtil } from '@sqlite.org/sqlite-wasm';
import { dbInfo, meta, query } from './dbQueries.ts';
import type { DbInfo, SqlDb } from './dbQueries.ts';

export type LocalDbRequest =
  | { id: number; type: 'status' }
  | { id: number; type: 'import'; file: File }
  | { id: number; type: 'remove' }
  | { id: number; type: 'query'; route: string; params: string; body?: unknown };

export type LocalDbReply =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string }
  | { id: number; progress: number };

const FILE = '/masters.db';
let pool: SAHPoolUtil | null = null;
let db: Database | null = null;
let sql: SqlDb | null = null;
let info: DbInfo = { exploreCache: false, openingsTable: false };

const ready = (async () => {
  const sqlite3 = await sqlite3InitModule();
  try {
    pool = await sqlite3.installOpfsSAHPoolVfs({ name: 'cc-masters', directory: '.cc-masters', initialCapacity: 4 });
  } catch {
    // no private file storage: Private Browsing, or a browser older than Safari 17 / iPadOS 17
    throw new Error('This browser can’t store files for websites here. Use Safari (not Private Browsing) on iPadOS 17 or newer, or Chrome/Edge on a computer.');
  }
  open();
})();

function close() {
  db?.close();
  db = null;
  sql = null;
}

function open() {
  close();
  if (!pool?.getFileNames().includes(FILE)) return;
  const d = new pool.OpfsSAHPoolDb(FILE);
  db = d;
  // sqlite-wasm refuses an (empty) binding list for a statement without parameters
  sql = {
    all: (q, params = []) => d.selectObjects(q, params.length ? params : undefined) as Record<string, unknown>[],
    get: (q, params = []) => d.selectObject(q, params.length ? params : undefined) as Record<string, unknown> | undefined,
  };
  info = dbInfo(sql);
}

function status() {
  if (!sql || !pool) return { ready: false, meta: null, bytes: 0 };
  const pages = sql.get('PRAGMA page_count') as { page_count: number };
  const size = sql.get('PRAGMA page_size') as { page_size: number };
  return { ready: true, meta: meta(sql), bytes: pages.page_count * size.page_size };
}

/** Streams the file into OPFS in chunks, so a database of any size fits in memory. */
async function importFile(id: number, file: File) {
  if (!pool) throw new Error('Storage is not available in this browser.');
  close();
  const reader = file.stream().getReader();
  let loaded = 0;
  let lastReport = 0;
  try {
    await pool.importDb(FILE, async () => {
      const { done, value } = await reader.read();
      if (done) return undefined;
      loaded += value.byteLength;
      if (loaded - lastReport > 8 * 1024 * 1024) {
        lastReport = loaded;
        postMessage({ id, progress: loaded / file.size } satisfies LocalDbReply);
      }
      return value;
    });
    open();
    if (!sql) throw new Error('The file could not be opened.');
    meta(sql); // a database from the ChessCoach build has a meta table; anything else fails here
    return status();
  } catch (e) {
    close();
    pool.unlink(FILE);
    throw new Error(/header|database|meta|no such table/i.test(String(e)) ? 'That file is not a ChessCoach master database (masters.db).' : String((e as Error).message ?? e));
  }
}

onmessage = async (e: MessageEvent<LocalDbRequest>) => {
  const msg = e.data;
  const reply = (r: LocalDbReply) => postMessage(r);
  try {
    await ready;
    if (msg.type === 'status') return reply({ id: msg.id, ok: true, result: status() });
    if (msg.type === 'import') return reply({ id: msg.id, ok: true, result: await importFile(msg.id, msg.file) });
    if (msg.type === 'remove') {
      close();
      await pool?.wipeFiles();
      return reply({ id: msg.id, ok: true, result: status() });
    }
    if (!sql) return reply({ id: msg.id, ok: true, result: [503, { error: 'NOT_BUILT' }] });
    return reply({ id: msg.id, ok: true, result: query(sql, info, msg.route, new URLSearchParams(msg.params), msg.body) });
  } catch (err) {
    reply({ id: msg.id, ok: false, error: (err as Error).message ?? String(err) });
  }
};
