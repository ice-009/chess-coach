import fs from 'node:fs';
import { DATA_DIR, STATUS_PATH } from './common.ts';
import type { BuildStatus } from './common.ts';

const current: Record<string, BuildStatus> = {};

/** Writes build progress to a status file (read by the app's Build buttons) and the console. */
export function report(update: Partial<BuildStatus>, file = STATUS_PATH) {
  current[file] = { ...(current[file] ?? { state: 'idle', step: '', progress: 0 }), ...update };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(current[file]));
  if (update.step) console.log(`[${Math.round(current[file].progress * 100)}%] ${update.step}`);
}
