// Quick Review picks the right moments and names the mistake correctly, on short games with a known answer
// (analysed by Stockfish in Node, like the app does in the browser).
// Usage: npm run test:moments
import { keyMoments } from '../src/lib/keyMoments.ts';
import { engine } from './stockfish-node.mjs';

const CASES = [
  { name: 'Scholar’s mate allowed', pgn: '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#', me: 'b', ply: 5, type: 'allowed-mate', reply: 'Qxf7#' },
  { name: 'queen moved where a knight takes it', pgn: '1. e4 e5 2. Qh5 Nc6 3. Qxe5+ Nxe5', me: 'w', ply: 4, type: 'moved-piece-lost', reply: 'Nxe5' },
  { name: 'bishop left attacked by a pawn', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. d3 axb5', me: 'w', ply: 6, type: 'missed-threat', reply: 'axb5' },
  { name: 'free queen not taken', pgn: '1. e4 e5 2. Nf3 Qh4 3. d3', me: 'w', ply: 4, type: 'missed-material', best: 'Nxh4', kind: 'missed-win' },
];

let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) failed++;
};
const sf = await engine();
for (const c of CASES) {
  const { game, analysis } = await sf.analyse(c.pgn, 14);
  const moments = keyMoments(game, analysis, c.me);
  const m = moments.find((x) => x.ply === c.ply);
  check(!!m, `${c.name}: the moment is found (${moments.map((x) => `${x.played.san}:${x.type}`).join(', ') || 'none'})`);
  if (!m) continue;
  check(m.type === c.type, `${c.name}: named “${m.type}” (expected ${c.type}): ${m.explain}`);
  if (c.reply) check(m.reply?.san === c.reply, `${c.name}: shows what it allowed (${m.reply?.san})`);
  if (c.best) check(m.best?.san === c.best, `${c.name}: shows the better move (${m.best?.san})`);
  if (c.kind) check(m.kind === c.kind, `${c.name}: counted as “${m.kind}”`);
  check(!!m.rule, `${c.name}: comes with a habit to take away`);
}
// a clean game has no moments
const { game, analysis } = await sf.analyse('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7', 12);
check(keyMoments(game, analysis, 'w').length === 0 && keyMoments(game, analysis, 'b').length === 0, 'a well-played opening has no key mistakes');
sf.quit();
console.log(failed ? `\n${failed} failure(s)` : '\nKey moments OK');
process.exit(failed ? 1 : 0);
