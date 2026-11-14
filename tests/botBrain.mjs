// The bots' move choice: book moves, styles and the softmax pick, with a seeded random source.
// Usage: npm run test:bots
import { Chess } from 'chess.js';
import { BOTS, LEVELS, bookMove, chooseMove, findBot, hangingValue, hangsAfter, lockedBy, naturalness, offerTaken, styleBonus, thinkTime } from '../src/lib/botBrain.ts';

let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) failed++;
};
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// the ladder
check(BOTS.length === 10 && BOTS.every((b, i) => i === 0 || b.rating > BOTS[i - 1].rating), 'ten bots, ratings strictly rising');
check(BOTS.every((b, i) => i === 0 || b.depth >= BOTS[i - 1].depth), 'stronger bots never search shallower');
check(new Set(BOTS.map((b) => b.slug)).size === BOTS.length, 'bot slugs are unique');
for (const b of BOTS)
  for (const line of b.book ?? []) {
    const c = new Chess();
    let ok = true;
    try { for (const s of line) c.move(s); } catch { ok = false; }
    if (!ok) check(false, `${b.name}'s book line ${line.join(' ')} is legal`);
  }
check(true, 'every book line is legal');

// book moves
const gia = findBot('gia');
const r = seeded(7);
const firstMoves = new Set(Array.from({ length: 40 }, () => bookMove(gia, [], () => 0.5 * r())));
check([...firstMoves].every((m) => ['e2e4', 'd2d4'].includes(m)), `Gia opens from her book (${[...firstMoves].join(', ')})`);
check(bookMove(gia, ['e4', 'e5'], () => 0.1) === 'f2f4', 'Gia plays the King’s Gambit after 1.e4 e5');
check(bookMove(gia, ['a3'], () => 0.1) === null, 'out of book after an unknown move');
check(bookMove(findBot('titan'), [], () => 0.1) === null, 'Titan has no book: it calculates');

// styles
const open = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3';
check(styleBonus(open, 'e1g1', 'solid') > 0, 'the solid style likes castling');
const checkPos = 'rnbqkbnr/ppppp2p/5p2/6p1/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3';
check(styleBonus(checkPos, 'd1h5', 'attacker') > styleBonus(checkPos, 'g1f3', 'attacker'), 'the attacker prefers a check to a quiet move');
check(styleBonus(open, 'e1g1', 'balanced') === 0, 'the balanced style has no taste');

// the pick
const cands = [{ uci: 'a', score: 50 }, { uci: 'b', score: 40 }, { uci: 'c', score: -300 }];
check(chooseMove(open, cands, LEVELS[6]) === cands[0], 'zero temperature always plays the best move');
const rr = seeded(3);
const picks = Array.from({ length: 400 }, () => chooseMove('8/8/8/8/8/8/8/K6k w - - 0 1', cands, { ...LEVELS[3], blunder: 0 }, rr).uci);
const share = (u) => picks.filter((p) => p === u).length / picks.length;
check(share('a') > share('b') && share('c') < 0.05, `close moves are mixed, a bad one is rare (a ${share('a').toFixed(2)}, b ${share('b').toFixed(2)}, c ${share('c').toFixed(2)})`);

// human-like mistakes: what the weak bots fail to see
// 1.e4 e5 2.Nf3 d6 3.Nxe5?: Black's pawn attacks the knight, and it's White to move
const loose = 'rnbqkbnr/ppp2ppp/3p4/4N3/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 3';
check(hangingValue('rnbqkbnr/ppp2ppp/3p4/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3') === 3, 'a loose knight is worth 3 to the side that can take it');
check(hangsAfter(loose, 'b1c3') === 3 && hangsAfter(loose, 'e5f3') === 0, 'Nc3 leaves the knight hanging, Nf3 saves it');
check(naturalness(loose, 'b1c3') > naturalness(loose, 'a2a3'), 'developing a knight looks more natural than a3');
const saveOrHang = [
  { uci: 'e5f3', score: 0 }, { uci: 'e5c4', score: -15 }, { uci: 'e5d3', score: -40 },
  { uci: 'b1c3', score: -290 }, { uci: 'f1c4', score: -280 }, { uci: 'd1h5', score: -300 }, { uci: 'a2a3', score: -320 },
];
const hangRate = (bot, seed) => {
  const rnd = seeded(seed);
  const n = 600;
  let hung = 0;
  for (let i = 0; i < n; i++) if (hangsAfter(loose, chooseMove(loose, saveOrHang, bot, rnd).uci) > 0) hung++;
  return hung / n;
};
const pipHang = hangRate(findBot('pip'), 11), riyaHang = hangRate(findBot('riya'), 12), noraHang = hangRate(findBot('nora'), 13);
const hugoHang = hangRate(findBot('hugo'), 20), miraHang = hangRate(findBot('mira'), 21), titanHang = hangRate(findBot('titan'), 22);
check(pipHang > 0.15, `Pip often leaves an attacked knight hanging (${(100 * pipHang).toFixed(0)}%)`);
check(pipHang > riyaHang && riyaHang >= noraHang, `weaker bots hang it more (Pip ${(100 * pipHang).toFixed(0)}%, Riya ${(100 * riyaHang).toFixed(0)}%, Nora ${(100 * noraHang).toFixed(1)}%)`);
check(noraHang > hugoHang && miraHang < 0.03 && titanHang === 0, `strong bots basically never do (Hugo ${(100 * hugoHang).toFixed(1)}%, Mira ${(100 * miraHang).toFixed(1)}%, Titan ${(100 * titanHang).toFixed(1)}%)`);

// 1.e4 Nc6 2.Nf3 Ne5?: the knight is loose
const offered = 'r1bqkbnr/pppppppp/8/4n3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 3 3';
check(offerTaken(offered, 'f3e5') === 3 && offerTaken(offered, 'b1c3') === 0, 'Nxe5 takes a loose knight');
const takeOrNot = [{ uci: 'f3e5', score: 320 }, { uci: 'b1c3', score: 20 }, { uci: 'f1c4', score: 15 }, { uci: 'd2d3', score: 0 }];
const missRate = (bot, seed) => {
  const rnd = seeded(seed);
  let missed = 0;
  for (let i = 0; i < 600; i++) if (chooseMove(offered, takeOrNot, bot, rnd).uci !== 'f3e5') missed++;
  return missed / 600;
};
const pipMiss = missRate(findBot('pip'), 31), miraMiss = missRate(findBot('mira'), 32);
check(pipMiss > 0.3 && miraMiss < 0.08, `Pip often misses a free knight (${(100 * pipMiss).toFixed(0)}%), Mira doesn't (${(100 * miraMiss).toFixed(1)}%)`);
const same = (seed) => Array.from({ length: 20 }, ((r) => () => chooseMove(loose, saveOrHang, findBot('milo'), r).uci)(seeded(seed))).join();
check(same(5) === same(5), 'the pick is deterministic for a given random source');

// the ladder
const pip = findBot('pip'), milo = findBot('milo');
check(lockedBy('pip', {}) === null, 'Pip is always open');
check(lockedBy('milo', {}) === pip && lockedBy('titan', {})?.slug === 'mira', 'with no games, Milo waits for Pip and Titan for Mira');
check(lockedBy('milo', { pip: { w: 1, d: 0, l: 3 } }) === null && lockedBy('milo', { pip: { w: 0, d: 1, l: 0 } }) === null, 'beating or drawing Pip opens Milo');
check(lockedBy('milo', { pip: { w: 0, d: 0, l: 5 } }) === pip, 'only losses to Pip keep Milo locked');
check(lockedBy('riya', { pip: { w: 1, d: 0, l: 0 } }) === milo, 'beating Pip doesn’t open Riya: Milo is next');
check(lockedBy('nora', { nora: { w: 0, d: 1, l: 0 } }) === null, 'a bot you already scored against (from a link) stays open');
check(BOTS.every((b) => lockedBy(b.slug, {}, true) === null), '"Unlock all" opens every bot');

// thinking time
check(thinkTime(LEVELS[3], null) === 450, 'no clock: a short fixed pause');
const t = thinkTime(BOTS[5], 60_000, () => 0.5);
check(t >= 250 && t <= 15_000, `with a minute left it thinks ${Math.round(t)} ms`);
check(thinkTime(BOTS[9], 2000, () => 1) <= 500, 'in time trouble it moves fast');

console.log(failed ? `\n${failed} failure(s)` : '\nBots OK');
process.exit(failed ? 1 : 0);
