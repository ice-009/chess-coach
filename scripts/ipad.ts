// npm run ipad: serves the full app (master database, puzzles, AI coach) to an iPad on the same Wi-Fi as this Mac.
// Other devices on the network need a one-time access code (see server/lanGuard.ts).
import { execSync, spawn, spawnSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CODE_FILE = path.join(ROOT, '.ipad-code.local'); // git-ignored (*.local)
const PORT = Number(process.env.PORT ?? 5173);
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no 0/o, 1/l/i: easy to type on the iPad

/** The access code, created once and then reused so devices that already entered it stay signed in. */
function accessCode(): string {
  try {
    const saved = fs.readFileSync(CODE_FILE, 'utf8').trim();
    if (/^[a-z0-9]{6,}$/.test(saved)) return saved;
  } catch {
    // first run
  }
  const code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  fs.writeFileSync(CODE_FILE, `${code}\n`, { mode: 0o600 });
  return code;
}

const lanAddresses = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a!.address);

/** "Your-Mac.local": stays the same when the router hands out a new IP address. */
function bonjourName(): string | null {
  if (process.platform !== 'darwin') return null;
  try {
    return `${execSync('scutil --get LocalHostName', { encoding: 'utf8' }).trim()}.local`;
  } catch {
    return null;
  }
}

const code = accessCode();
const vite = path.join(ROOT, 'node_modules', '.bin', 'vite');
// node:sqlite (the database API) prints an "experimental" warning on every start; it's harmless
const env = { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --disable-warning=ExperimentalWarning`.trim() };
if (!process.argv.includes('--no-build')) {
  console.log('Building the app…');
  const build = spawnSync(vite, ['build', '--logLevel', 'warn'], { cwd: ROOT, stdio: 'inherit', env });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const server = spawn(vite, ['preview', '--host', '0.0.0.0', '--port', String(PORT), '--strictPort'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'inherit'],
  env: { ...env, CC_LAN_TOKEN: code },
});
let announced = false;
server.stdout.on('data', (chunk: Buffer) => {
  if (announced || !String(chunk).includes('http')) return;
  announced = true;
  const hosts = [bonjourName(), ...lanAddresses()].filter(Boolean);
  console.log(`
  ChessCoach is ready for your iPad (it must be on the same Wi-Fi as this Mac).

  On the iPad, open Safari and go to:
${hosts.map((h, i) => `    ${i ? 'or ' : ''}http://${h}:${PORT}/?t=${code}`).join('\n')}

  Access code: ${code}   (each device asks for it once)
  Tip: Share → Add to Home Screen gives a full-screen app; it asks for the code once too.
  On this Mac: http://localhost:${PORT}

  Keep this window open: the Mac stays awake while it runs. Press Ctrl+C to stop.
`);
});
server.on('exit', (status) => process.exit(status ?? 0));
// keep the Mac from sleeping (and dropping the connection) while the server runs
if (process.platform === 'darwin' && server.pid) spawn('caffeinate', ['-i', '-w', String(server.pid)], { stdio: 'ignore' });
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => server.kill(sig));
