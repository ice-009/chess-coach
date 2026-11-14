// How strong are the bots really? Plays each bot against Stockfish held to a fixed UCI_Elo (the anchors) and against
// its neighbours on the ladder, then fits ratings to all the results (anchors fixed) and prints them beside the ratings
// in BOTS. The bots move exactly as in the app: book, then multiPV Stockfish (the lite net) and chooseMove.
// Run: node --experimental-strip-types --no-warnings scripts/calibrate-bots.ts [games per pairing = 8] [--movetime=100] [--jobs=8] [--only=pip,milo]
// Rough by design: Stockfish's UCI_Elo is an engine-list scale (lowest 1320), and a few games per pairing leave ±100 or so.
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { Chess } from 'chess.js';
import { BOTS, bookMove, chooseMove } from '../src/lib/botBrain.ts';
import type { Bot, Candidate } from '../src/lib/botBrain.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const opt = (name: string, def: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? def;
const GAMES = Number(args.find((a) => /^\d+$/.test(a)) ?? 8);
const MOVETIME = Number(opt('movetime', '100'));
const JOBS = Number(opt('jobs', String(Math.max(1, Math.min(8, cpus().length - 2)))));
const ONLY = opt('only', '').split(',').filter(Boolean);
const ANCHORS = [1320, 1600, 1900, 2200, 2500, 2800];
const MAX_PLIES = 240;
// the strong anchors pick their move only once they reach a depth, so give them time to get there
const anchorTime = (elo: number) => Math.round(MOVETIME * (1 + Math.max(0, elo - 1800) / 400));

// ── a UCI engine in a child process ──
interface Uci {
  send: (cmd: string) => void;
  search: (cmds: string[]) => Promise<string[]>; // every line up to and including bestmove
  quit: () => void;
}

function uci(file: string, setup: string[]): Promise<Uci> {
  const sf = spawn('node', [`node_modules/stockfish/bin/${file}`], { cwd: ROOT });
  let buf = '';
  let lines: string[] = [];
  let waiting: ((l: string[]) => void) | null = null;
  let until = '';
  sf.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      lines.push(line);
      if (waiting && line.startsWith(until)) {
        const w = waiting;
        waiting = null;
        w(lines);
        lines = [];
      }
    }
  });
  const send = (cmd: string) => sf.stdin.write(cmd + '\n');
  const wait = (prefix: string) => new Promise<string[]>((res) => { lines = []; until = prefix; waiting = res; });
  const e: Uci = {
    send,
    search: (cmds) => { const p = wait('bestmove'); cmds.forEach(send); return p; },
    quit: () => { send('quit'); sf.stdin.end(); },
  };
  const ready = wait('readyok');
  ['uci', ...setup, 'isready'].forEach(send);
  return ready.then(() => e);
}

const scoreOf = (kind: string, n: number) => (kind === 'mate' ? (n > 0 ? 100000 - n : -100000 - n) : n);

/** The bot's move, as bot.ts plays it. Also returns its evaluation (side to move) for adjudication. */
async function botMove(eng: Uci, bot: Bot, fen: string, history: string[]): Promise<{ uci: string; score: number | null }> {
  const book = bookMove(bot, history);
  if (book) return { uci: book, score: null };
  const out = await eng.search([`setoption name MultiPV value ${bot.multiPv}`, `position fen ${fen}`, `go depth ${bot.depth}`]);
  const byPv = new Map<number, Candidate>();
  for (const l of out) {
    const m = l.match(/ multipv (\d+) score (cp|mate) (-?\d+).* pv (\S+)/);
    if (m && !l.includes('bound')) byPv.set(Number(m[1]), { uci: m[4], score: scoreOf(m[2], Number(m[3])) });
  }
  const cands = [...byPv.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c);
  if (!cands.length) return { uci: out.at(-1)!.split(' ')[1], score: null };
  const pick = chooseMove(fen, cands, bot);
  return { uci: pick.uci, score: cands[0].score };
}

// ── players and games ──
type Player = { kind: 'bot'; bot: Bot } | { kind: 'sf'; elo: number };
const nameOf = (p: Player) => (p.kind === 'bot' ? p.bot.slug : `sf${p.elo}`);

interface Slot {
  bots: [Uci, Uci];
  sf: Uci;
}

/** One game; returns White's score (1, ½ or 0). */
async function playGame(slot: Slot, white: Player, black: Player): Promise<number> {
  const c = new Chess();
  const history: string[] = [];
  const decisive: Record<'w' | 'b', number> = { w: 0, b: 0 }; // plies in a row the bot to move has seen itself lost
  for (const e of [...slot.bots, slot.sf]) e.send('ucinewgame');
  while (!c.isGameOver() && history.length < MAX_PLIES) {
    const side = c.turn();
    const p = side === 'w' ? white : black;
    let move: string;
    if (p.kind === 'bot') {
      const r = await botMove(slot.bots[side === 'w' ? 0 : 1], p.bot, c.fen(), history);
      move = r.uci;
      // adjudicate a hopeless position: the side to move's own engine says it's lost by 15+ pawns for 10 moves
      decisive[side] = r.score !== null && r.score < -1500 ? decisive[side] + 1 : 0;
      if (decisive[side] >= 10) return side === 'w' ? 0 : 1;
    } else {
      const out = await slot.sf.search([`setoption name UCI_Elo value ${p.elo}`, `position fen ${c.fen()}`, `go movetime ${anchorTime(p.elo)}`]);
      move = out.at(-1)!.split(' ')[1];
    }
    const m = c.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
    history.push(m.san);
  }
  if (c.isCheckmate()) return c.turn() === 'w' ? 0 : 1;
  return 0.5;
}

// ── the schedule: neighbours on the ladder, and each bot against the anchors near its rating ──
interface Pairing {
  a: Player;
  b: Player;
  score: number; // a's points
  games: number;
}

const ladder = BOTS.filter((b) => !ONLY.length || ONLY.includes(b.slug));
const pairings: Pairing[] = [];
for (let i = 0; i + 1 < ladder.length; i++) pairings.push({ a: { kind: 'bot', bot: ladder[i] }, b: { kind: 'bot', bot: ladder[i + 1] }, score: 0, games: 0 });
for (const bot of ladder) {
  const near = ANCHORS.filter((x) => Math.abs(x - bot.rating) <= 320);
  if (!near.length && bot.rating >= 1000) near.push(ANCHORS.reduce((a, x) => (Math.abs(x - bot.rating) < Math.abs(a - bot.rating) ? x : a)));
  for (const elo of near) pairings.push({ a: { kind: 'bot', bot }, b: { kind: 'sf', elo }, score: 0, games: 0 });
}

const jobs: { p: Pairing; aWhite: boolean }[] = [];
for (let g = 0; g < GAMES; g++) for (const p of pairings) jobs.push({ p, aWhite: g % 2 === 0 });

console.log(`${pairings.length} pairings × ${GAMES} games = ${jobs.length} games, ${JOBS} at a time, anchors at ${MOVETIME}–${anchorTime(2800)} ms a move\n`);
const t0 = Date.now();
let done = 0;
async function worker() {
  const lite = 'stockfish-19-lite-single.js';
  const slot: Slot = {
    bots: [await uci(lite, ['setoption name Threads value 1']), await uci(lite, ['setoption name Threads value 1'])],
    sf: await uci('stockfish-19-single.js', ['setoption name Threads value 1', 'setoption name UCI_LimitStrength value true']),
  };
  for (let job = jobs.shift(); job; job = jobs.shift()) {
    const { p, aWhite } = job;
    const w = await playGame(slot, aWhite ? p.a : p.b, aWhite ? p.b : p.a);
    p.score += aWhite ? w : 1 - w;
    p.games++;
    done++;
    process.stdout.write(`\r${done} games, ${Math.round((Date.now() - t0) / 1000)} s`);
  }
  [...slot.bots, slot.sf].forEach((e) => e.quit());
}
await Promise.all(Array.from({ length: JOBS }, worker));
console.log('\n');

// ── fit: maximum likelihood with the anchors fixed; one virtual draw per pairing keeps 0% and 100% finite ──
const expect = (ra: number, rb: number) => 1 / (1 + 10 ** ((rb - ra) / 400));
const est = new Map<string, number>(ladder.map((b) => [b.slug, b.rating]));
const ratingOf = (p: Player) => (p.kind === 'sf' ? p.elo : est.get(p.bot.slug)!);
for (let it = 0; it < 500; it++) {
  for (const bot of ladder) {
    let grad = 0, hess = 0;
    for (const p of pairings) {
      const mine = p.a.kind === 'bot' && p.a.bot === bot ? 'a' : p.b.kind === 'bot' && p.b.bot === bot ? 'b' : null;
      if (!mine) continue;
      const [me, them] = mine === 'a' ? [p.a, p.b] : [p.b, p.a];
      const n = p.games + 1;
      const s = (mine === 'a' ? p.score : p.games - p.score) + 0.5;
      const e = expect(ratingOf(me), ratingOf(them));
      grad += s - n * e;
      hess += n * e * (1 - e);
    }
    if (hess > 0) est.set(bot.slug, est.get(bot.slug)! + Math.max(-200, Math.min(200, (400 / Math.LN10) * (grad / hess))));
  }
}

console.log('Pairings');
for (const p of pairings) console.log(`  ${nameOf(p.a).padEnd(8)} vs ${nameOf(p.b).padEnd(8)} ${String(p.score).padStart(5)} / ${p.games}`);
console.log('\nbot       current  estimated  games  score');
for (const bot of ladder) {
  let s = 0, n = 0;
  for (const p of pairings) {
    if (p.a.kind === 'bot' && p.a.bot === bot) { s += p.score; n += p.games; }
    if (p.b.kind === 'bot' && p.b.bot === bot) { s += p.games - p.score; n += p.games; }
  }
  const e = Math.round(est.get(bot.slug)! / 10) * 10;
  console.log(`${bot.name.padEnd(9)} ${String(bot.rating).padStart(7)}  ${String(e).padStart(9)}  ${String(n).padStart(5)}  ${(n ? (100 * s) / n : 0).toFixed(0).padStart(4)}%`);
}
console.log(`\n${Math.round((Date.now() - t0) / 1000)} s`);
