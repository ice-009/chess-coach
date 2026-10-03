// npm run deploy: builds the hosted version (no master database, no AI coach) and publishes it to Vercel.
// deploy/chess-coach is the git-ignored staging folder linked to the Vercel project (.vercel/project.json).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const STAGE = path.join(ROOT, 'deploy', 'chess-coach');
const run = (cmd: string, args: string[], cwd = ROOT) => {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run('npm', ['run', 'build:static']);
fs.mkdirSync(STAGE, { recursive: true });
for (const f of fs.readdirSync(STAGE)) if (f !== '.vercel') fs.rmSync(path.join(STAGE, f), { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'dist'), STAGE, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'vercel.json'), path.join(STAGE, 'vercel.json'));
fs.writeFileSync(path.join(STAGE, '.gitignore'), '.vercel\n');
run('npx', ['--yes', 'vercel@latest', 'deploy', '--prod', '--yes'], STAGE);
