// How many moves the review can explain: plays famous games through Stockfish and counts the moves for which
// explainChoice finds no reason (for the move played, and for the engine's better move when there is one).
// Also checks that the finer ideas (prophylaxis, space, worst piece, simplifying, king weakening) fire, on
// fixed positions and in the games, and that the other side's moves are told in the third person.
// Usage: node --experimental-strip-types --no-warnings tests/explainCoverage.mjs [depth]
import { Chess } from 'chess.js';
import { drawbacks, explainChoice, whyMove } from '../src/lib/moveReasons.ts';
import { CLASSICS } from '../src/data/classics.ts';
import { engine } from './stockfish-node.mjs';

let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) failed++;
};

// fixed positions with a known idea (no engine needed)
const kindOf = (fen, uci) => whyMove(fen, uci, [uci], { ply: 40 }).map((r) => r.kind).filter(Boolean);
const FIXED = [
  ['prophylaxis', '6k1/5ppp/8/8/1n6/8/5PPP/R3QBK1 w - - 0 30', 'e1e2', 'Qe2 stops the knight fork Nc2'],
  ['space', 'r1bq1rk1/pp1nbppp/2p1pn2/3p4/2PP4/2N1PN2/PPQ1BPPP/R1B2RK1 w - - 0 12', 'c4c5', 'c5 gains space on the queenside'],
  ['worst-piece', 'r4rk1/pp1bqppp/2p1pn2/3p4/3P4/2PBP3/PPQ2PPP/1N1RR1K1 w - - 0 15', 'b1d2', 'Nd2 brings the idle knight on b1 into play'],
  ['simplify', '3q1rk1/1pp2ppp/p7/8/2P5/4P3/PP3PPP/R2Q1RK1 w - - 0 25', 'd1d4', 'a rook up, Qd4 offers a queen trade'],
];
for (const [kind, fen, uci, what] of FIXED) check(kindOf(fen, uci).includes(kind), `${kind}: ${what}`);
const kingFen = 'r4rk1/pp1bqppp/2p1pn2/3p4/3P4/2PBP3/PPQ2PPP/1N1RR1K1 w - - 0 15';
check(/f3 and h3/.test(drawbacks(kingFen, 'g2g4', { ply: 28 })[0]?.text ?? ''), 'king-weakness: g4 leaves f3 and h3 without pawn cover');
check(drawbacks(kingFen, 'h2h3', { ply: 28 }).length === 0, 'king-weakness: h3 is not flagged (f2 still guards g3)');
check(kindOf('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e2e4').length === 0, 'no finer idea for 1.e4 (the centre rule explains it)');

const depth = Number(process.argv[2] ?? 10);
const sf = await engine();
let played = 0, playedEmpty = 0, best = 0, bestEmpty = 0, thirdOk = 0, thirdBad = 0;
const themes = new Map();
const kinds = new Map();
const samples = [];
const examples = [];
for (const g of CLASSICS) {
  const san = g.moves.replace(/\{[^}]*\}/g, ' ').replace(/\d+\.(\.\.)?/g, ' ').split(/\s+/).filter(Boolean);
  const c = new Chess();
  for (const s of san) c.move(s);
  const { game, analysis } = await sf.analyse(c.pgn(), depth);
  for (let i = 0; i < game.moves.length; i++) {
    const e = explainChoice(game, analysis, i);
    const label = `${g.id} ${Math.floor(i / 2) + 1}${i % 2 ? '…' : '.'}`;
    played++;
    if (!e.played.reasons.length) {
      playedEmpty++;
      if (samples.length < 40 && Math.random() < 0.3) samples.push(`${label}${e.played.san}`);
    }
    e.played.reasons.forEach((r) => themes.set(r.theme, (themes.get(r.theme) ?? 0) + 1));
    for (const mw of [e.played, e.best]) {
      for (const r of [...(mw?.reasons ?? []), ...(mw?.drawbacks ?? [])]) {
        if (!r.kind) continue;
        kinds.set(r.kind, (kinds.get(r.kind) ?? 0) + 1);
        if (examples.length < 12) examples.push(`${label}${mw.san}: ${r.text}`);
      }
    }
    if (e.best) {
      best++;
      if (!e.best.reasons.length) bestEmpty++;
    }
    // told from the other side: no "you" or "your" left, the side is named instead
    const viewer = game.moves[i].color === 'w' ? 'b' : 'w';
    for (const r of explainChoice(game, analysis, i, viewer).played.reasons) {
      if (/\byour?\b/i.test(r.text)) thirdBad++;
      else thirdOk++;
    }
  }
}
sf.quit();
const pct = (a, b) => `${b ? Math.round((a / b) * 100) : 0}%`;
console.log(`Games: ${CLASSICS.length}, depth ${depth}`);
console.log(`Moves played explained: ${played - playedEmpty}/${played} (${pct(played - playedEmpty, played)})`);
console.log(`Better moves explained: ${best - bestEmpty}/${best} (${pct(best - bestEmpty, best)})`);
console.log('Themes:', [...themes.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', '));
console.log('Finer ideas in the games:', [...kinds.entries()].map(([t, n]) => `${t} ${n}`).join(', ') || 'none');
console.log('Examples:\n  ' + examples.join('\n  '));
console.log('Unexplained samples:', samples.join(' | '));
check(played - playedEmpty >= played * 0.9, 'at least 90% of the moves played get a reason');
check(kinds.size > 0, 'the finer ideas fire in the classic games too');
check(thirdBad === 0, `the other side's moves are told in the third person (${thirdOk} reasons, ${thirdBad} with "you")`);
console.log(failed ? `\n${failed} failure(s)` : '\nExplanation checks OK');
process.exit(failed ? 1 : 0);
