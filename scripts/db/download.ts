// Downloads master games for personal use:
//   - TWIC (The Week in Chess): weekly over-the-board games, "free for personal use only"
//   - pgnmentor.com player collections: historical and elite players, "available for download, completely free"
//   - lichess chess-openings (CC0): opening names
// Usage: node --experimental-strip-types scripts/db/download.ts [--issues 52]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { SOURCES_DIR } from './common.ts';
import { report } from './status.ts';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const CHAMPIONS = [
  'Morphy', 'Anderssen', 'Steinitz', 'Lasker', 'Capablanca', 'Alekhine', 'Euwe', 'Botvinnik', 'Smyslov', 'Tal',
  'Petrosian', 'Spassky', 'Fischer', 'Karpov', 'Kasparov', 'Kramnik', 'Anand', 'Topalov', 'Carlsen', 'Ding', 'Gukesh',
  'Nimzowitsch', 'Rubinstein', 'Keres', 'Bronstein', 'Korchnoi', 'Larsen', 'Polugaevsky', 'Ivanchuk', 'Shirov',
  'Nakamura', 'Caruana', 'Aronian', 'Giri', 'Nepomniachtchi', 'So', 'Firouzja',
];

async function fetchOk(url: string, binary: true): Promise<Buffer>;
async function fetchOk(url: string, binary?: false): Promise<string>;
async function fetchOk(url: string, binary = false): Promise<Buffer | string> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
    } catch (e) {
      if (attempt >= 3) throw e;
      await sleep(2000 * attempt);
    }
  }
}

function unzipTo(zip: Buffer, dir: string, name: string) {
  const tmp = path.join(dir, `${name}.zip`);
  fs.writeFileSync(tmp, zip);
  execFileSync('unzip', ['-o', '-q', tmp, '-d', dir]);
  fs.rmSync(tmp);
}

export async function download(issues: number, base = 0, span = 1) {
  const twicDir = path.join(SOURCES_DIR, 'twic');
  const pgnmDir = path.join(SOURCES_DIR, 'pgnmentor');
  const openDir = path.join(SOURCES_DIR, 'openings');
  for (const d of [twicDir, pgnmDir, openDir]) fs.mkdirSync(d, { recursive: true });

  // opening names
  for (const f of ['a', 'b', 'c', 'd', 'e']) {
    const out = path.join(openDir, `${f}.tsv`);
    if (!fs.existsSync(out)) fs.writeFileSync(out, await fetchOk(`https://raw.githubusercontent.com/lichess-org/chess-openings/master/${f}.tsv`));
  }

  // latest TWIC issue number from the index page
  const page = await fetchOk('https://theweekinchess.com/twic');
  const latest = Math.max(...[...page.matchAll(/twic(\d{3,4})g\.zip/g)].map((m) => Number(m[1])));
  if (!Number.isFinite(latest)) throw new Error('Could not find the latest TWIC issue');
  const wanted = Array.from({ length: issues }, (_, i) => latest - i).filter((n) => n > 0);

  const total = wanted.length + CHAMPIONS.length;
  let done = 0;
  for (const n of wanted) {
    done++;
    if (fs.existsSync(path.join(twicDir, `twic${n}.pgn`))) continue;
    report({ state: 'downloading', step: `Downloading TWIC issue ${n} (${done}/${wanted.length})`, progress: base + (span * done) / total });
    try {
      unzipTo(await fetchOk(`https://theweekinchess.com/zips/twic${n}g.zip`, true), twicDir, `twic${n}`);
    } catch (e) {
      console.warn(`skipped TWIC ${n}: ${(e as Error).message}`);
    }
    await sleep(400); // be polite to a free, volunteer-run site
  }
  for (const p of CHAMPIONS) {
    done++;
    if (fs.existsSync(path.join(pgnmDir, `${p}.pgn`))) continue;
    report({ state: 'downloading', step: `Downloading ${p}'s games (pgnmentor)`, progress: base + (span * done) / total });
    try {
      unzipTo(await fetchOk(`https://www.pgnmentor.com/players/${p}.zip`, true), pgnmDir, p);
    } catch (e) {
      console.warn(`skipped ${p}: ${(e as Error).message}`);
    }
    await sleep(400);
  }
  return { latest, issues: wanted.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--issues');
  const issues = i > 0 ? Number(process.argv[i + 1]) : 52;
  download(issues).then((r) => console.log(`downloaded up to TWIC ${r.latest} (${r.issues} issues)`));
}
