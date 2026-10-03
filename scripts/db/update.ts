// Download + build in one go. Used by `npm run db:update` and by the app's "Build database" button.
// Usage: node --experimental-strip-types scripts/db/update.ts [--issues 52] [--min-elo 2000]
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './common.ts';
import { download } from './download.ts';
import { build } from './build.ts';
import { report } from './status.ts';

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const issues = arg('--issues', 52);
const minElo = arg('--min-elo', 2000);
const lock = path.join(DATA_DIR, 'build.lock');

fs.mkdirSync(DATA_DIR, { recursive: true });
if (fs.existsSync(lock) && Date.now() - fs.statSync(lock).mtimeMs < 3 * 3600_000) {
  console.error('A database build is already running.');
  process.exit(1);
}
fs.writeFileSync(lock, String(process.pid));
const t0 = Date.now();
report({ state: 'downloading', step: 'Starting…', progress: 0, startedAt: t0, error: undefined, finishedAt: undefined });
try {
  await download(issues, 0, 0.35);
  const games = await build(minElo, 0.35, 0.65);
  report({ state: 'done', step: `Done: ${games.toLocaleString()} master games`, progress: 1, games, finishedAt: Date.now() });
  console.log(`finished in ${Math.round((Date.now() - t0) / 1000)}s`);
} catch (e) {
  report({ state: 'error', step: 'Failed', error: (e as Error).message, finishedAt: Date.now() });
  console.error(e);
  process.exitCode = 1;
} finally {
  fs.rmSync(lock, { force: true });
}
