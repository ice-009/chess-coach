// Access code for "iPad mode" (npm run ipad): the app is served to the home network, so other devices on the
// same Wi-Fi must not be able to use the master database or the AI coach (and its API key). Requests from the
// Mac itself pass; any other device needs the code once, after which a cookie remembers it.
import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';

const COOKIE = 'cc_lan';
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function cookieValue(req: IncomingMessage): string {
  const m = (req.headers.cookie ?? '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : '';
}

function codePage(res: ServerResponse, wrong: boolean) {
  res.statusCode = 401;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ChessCoach</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#312e2b;color:#fff;font:16px -apple-system,system-ui,sans-serif}
form{background:#262421;border-radius:12px;padding:28px;max-width:340px;text-align:center}
input{font:inherit;font-size:24px;letter-spacing:.2em;text-align:center;width:100%;box-sizing:border-box;padding:12px;border-radius:8px;border:1px solid #4b4847;background:#1b1a18;color:#fff;margin:14px 0}
button{font:inherit;font-weight:800;background:#81b64c;color:#fff;border:0;border-radius:8px;padding:12px 20px;width:100%}
p{color:#c3c2c1;line-height:1.5;margin:0}.bad{color:#ff8a7a;margin-top:10px}</style></head><body>
<form method="get" action="/"><p><b>ChessCoach on your Mac</b><br>Enter the access code shown in the Mac’s terminal (<code>npm run ipad</code>).</p>
<input name="t" autocomplete="off" autocapitalize="none" spellcheck="false" inputmode="text" autofocus>
<button>Open</button>${wrong ? '<p class="bad">That code is not right.</p>' : ''}</form></body></html>`);
}

/** Active only when CC_LAN_TOKEN is set (by scripts/ipad.ts). */
export function lanGuard(token: string | undefined): Plugin {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    if (!token || LOOPBACK.has(req.socket.remoteAddress ?? '')) return next();
    if (same(cookieValue(req), token)) return next();
    const url = new URL(req.url ?? '/', 'http://x');
    const given = url.searchParams.get('t');
    if (given !== null) {
      if (same(given.trim().toLowerCase(), token)) {
        // remember this device for a year, then drop the code from the address bar
        res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax`);
        url.searchParams.delete('t');
        res.statusCode = 302;
        res.setHeader('Location', url.pathname + (url.search || '') + url.hash);
        return res.end();
      }
      return setTimeout(() => codePage(res, true), 600); // slow down guessing
    }
    if (url.pathname.startsWith('/api/') || /\.\w+$/.test(url.pathname)) {
      res.statusCode = 401;
      return res.end();
    }
    codePage(res, false);
  };
  return {
    name: 'chess-coach-lan-guard',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}
