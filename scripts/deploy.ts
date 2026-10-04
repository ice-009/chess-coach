// npm run deploy: builds the hosted version (no master database, no AI coach) on this Mac and publishes it to
// Vercel, with the accounts function. Pushing to main on GitHub deploys the same build (vercel.json), so this is
// for publishing local, uncommitted changes.
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
// the staging folder is already built: keep the headers, drop the build settings Git deployments use
const { buildCommand: _b, outputDirectory: _o, ...prebuilt } = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
fs.writeFileSync(path.join(STAGE, 'vercel.json'), JSON.stringify(prebuilt, null, 2));
// accounts: api/account.ts becomes the /api/account serverless function (its Upstash keys are Vercel env vars)
fs.cpSync(path.join(ROOT, 'api'), path.join(STAGE, 'api'), { recursive: true });
fs.writeFileSync(path.join(STAGE, '.gitignore'), '.vercel\n');
run('npx', ['--yes', 'vercel@latest', 'deploy', '--prod', '--yes'], STAGE);
