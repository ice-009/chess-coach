// Serves /api/account inside the Vite dev/preview server (the Mac app and tests). Same handler as the hosted
// Vercel function, with accounts kept in data/accounts.json (git-ignored) instead of Upstash Redis.
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';
import { handle, memoryStore } from '../api/account.ts';
import { ROOT } from '../scripts/db/common.ts';

const FILE = path.join(ROOT, 'data', 'accounts.json');

function fileStore() {
  let initial = {};
  try {
    initial = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    // no accounts yet
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  return memoryStore(initial, (all) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(all), { mode: 0o600 });
    }, 200);
  });
}

async function toRequest(req: IncomingMessage): Promise<Request> {
  const proto = (req.socket as { encrypted?: boolean }).encrypted ? 'https' : 'http';
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  headers.set('x-forwarded-for', req.socket.remoteAddress ?? 'local');
  const chunks: Buffer[] = [];
  if (req.method !== 'GET' && req.method !== 'HEAD') for await (const c of req) chunks.push(c as Buffer);
  return new Request(`${proto}://${req.headers.host}${req.url}`, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
}

export function accountsDev(): Plugin {
  const store = fileStore();
  const handler: Connect.NextHandleFunction = (req, res: ServerResponse, next) => {
    if (!req.url?.startsWith('/api/account')) return next();
    toRequest(req)
      .then((r) => handle(r, store))
      .then(async (out) => {
        res.writeHead(out.status, Object.fromEntries(out.headers));
        res.end(await out.text());
      })
      .catch((e) => {
        console.error('[account]', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Something went wrong. Try again.' }));
      });
  };
  return {
    name: 'accounts-dev',
    configureServer: (s) => void s.middlewares.use(handler),
    configurePreviewServer: (s) => void s.middlewares.use(handler),
  };
}
