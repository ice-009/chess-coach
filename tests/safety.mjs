// "Is it safe?" judges moves correctly and explains them in plain words, on positions with a known answer
// (Stockfish in Node). Usage: npm run test:safety
import { afterMove, explainSafe, explainUnsafe, temptingMoves, verdictOf } from '../src/lib/safety.ts';
import { engine } from './stockfish-node.mjs';

let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) failed++;
};
const sf = await engine();
// the app's engine reports scores from the side to move; the test engine from White's side
async function score(fen) {
  const e = await sf.evaluate(fen, 14);
  const s = fen.split(' ')[1] === 'w' ? 1 : -1;
  return { cp: e.mate === null ? e.cp * s : null, mate: e.mate === null ? null : e.mate * s, bestMove: e.bestMove, pv: e.pv ?? [] };
}
async function judge(fen, uci) {
  const best = await score(fen);
  const after = await score(afterMove(fen, uci));
  const v = verdictOf(best, after);
  const text = v.verdict === 'unsafe' ? explainUnsafe(fen, uci, after.bestMove, after.pv.slice(1), after.mate) : explainSafe(fen, uci);
  return { ...v, text };
}

const queenOut = await judge('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', 'd8g5');
check(queenOut.verdict === 'unsafe', `…Qg5?? is unsafe (lost ${queenOut.loss}%)`);
check(/queen can be taken on g5: Nxg5/.test(queenOut.text), `and the reason is the knight: “${queenOut.text}”`);

const scotch = await judge('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'd2d4');
check(scotch.verdict === 'safe', `3.d4 is safe (lost ${scotch.loss}%)`);
check(/defended by your/.test(scotch.text) && /queen on d1/.test(scotch.text) && /knight on f3/.test(scotch.text), `attacked but defended: “${scotch.text}”`);

const scholar = await judge('r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', 'g8f6');
check(scholar.verdict === 'unsafe' && /Qxf7# is checkmate/.test(scholar.text), `…Nf6?? walks into mate: “${scholar.text}”`);

const quiet = await judge('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'g1f3');
check(quiet.verdict === 'safe' && /Nothing attacks your knight on f3/.test(quiet.text), `1.Nf3 is safe: “${quiet.text}”`);

const moves = temptingMoves('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'f3g5');
check(moves[0] === 'f3g5' && moves.includes('f3e5') && moves.includes('d2d4'), `tempting moves: the given move first, then captures and contested squares (${moves.slice(0, 6).join(' ')})`);
sf.quit();
console.log(failed ? `\n${failed} failure(s)` : '\nSafety checks OK');
process.exit(failed ? 1 : 0);
