// Advanced stats on small hand-made inputs. Usage: npm run test:stats
import { accuracyByResult, blunderPieces, byHour, byOpponent, byTimeControl, byWeekday, conversion, gamePhaseAccuracy, moveCount, spread, themeSuccess, timePerMove } from '../src/lib/advancedStats.ts';
import { mergeDocs } from '../src/lib/sync.ts';
import { KEYS } from '../src/lib/storage.ts';

let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) failed++;
};

const row = (outcome, my, opp, date, extra = {}) => ({
  outcome, myRating: my, oppRating: opp, date: new Date(date), color: 'w', timeClass: 'blitz',
  game: { pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6', time_control: '180+2', url: Math.random().toString() }, ...extra,
});

// opponents
const rows = [row('win', 1200, 900, '2026-11-02T10:00'), row('loss', 1200, 1500, '2026-11-03T21:00'), row('draw', 1200, 1210, '2026-11-02T11:00'), row('win', 1200, 1100, '2026-11-08T20:00')];
const opp = byOpponent(rows);
check(opp.find((b) => b.label === '200+ lower')?.score === 100, 'a win against a much lower rated player is 100% in that band');
check(opp.find((b) => b.label === '200+ higher')?.score === 0, 'the loss to a higher rated player is 0% in that band');
check(opp.find((b) => b.label === 'About equal')?.score === 50, 'the draw against an equal is 50%');
check(byWeekday(rows)[0].label === 'Mon' && byWeekday(rows)[0].n === 2, 'Monday first, with its two games');
check(byHour(rows).find((b) => b.label.startsWith('Evening')).n === 2, 'two evening games');
check(spread([{ label: 'A', n: 6, score: 80 }, { label: 'B', n: 6, score: 40 }])?.best.label === 'A', 'a big gap between buckets is reported');
check(spread([{ label: 'A', n: 6, score: 52 }, { label: 'B', n: 6, score: 48 }]) === null, 'a small gap is not');

// move count and clock
check(moveCount('[Event "x"]\n\n1. e4 {[%clk 0:03:00]} 1... e5 2. Nf3 Nc6 3. Bb5 1-0') === 3, 'moves counted from move numbers');
const clockRow = row('win', 1200, 1200, '2026-11-01', { game: { time_control: '180+0', pgn: '1. e4 {[%clk 0:02:58]} 1... e5 {[%clk 0:02:59]} 2. Nf3 {[%clk 0:02:50]} 2... Nc6 {[%clk 0:02:55]}' } });
const t = timePerMove([clockRow]);
check(t.length === 1 && Math.abs(t[0].value - 5) < 0.01, `seconds per move from the clocks (2 s then 8 s → ${t[0]?.value})`);

// analyses
const mk = (cps, outcome, color = 'w') => ({
  row: { outcome, color },
  parsed: { fens: [], moves: [] },
  analysis: { evals: cps.map((cp) => ({ cp, mate: null })), reviews: [], accuracy: { w: 80, b: 70 } },
});
const conv = conversion([mk([0, 400, 600, 0], 'win'), mk([0, 500, 0, 0], 'draw'), mk([0, -600, -100, 0], 'draw')]);
check(conv.winning === 2 && conv.converted === 1 && conv.convertPct === 50, 'one of two won positions converted');
check(conv.losing === 1 && conv.saved === 1, 'the clearly lost game that was drawn counts as saved');
check(accuracyByResult([mk([0], 'win'), mk([0], 'loss')]).map((a) => a.label).join() === 'Wins,Losses', 'accuracy by result');

const fens = ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'];
const parsed = { fens, moves: [{ color: 'w', san: 'e4' }, { color: 'b', san: 'e5' }, { color: 'w', san: 'Nf3' }] };
const analysis = { reviews: [{ classification: 'best', accuracy: 100 }, { classification: 'best', accuracy: 90 }, { classification: 'blunder', accuracy: 40 }] };
check(gamePhaseAccuracy(parsed, analysis, 'w').opening === 70, 'opening accuracy averages your moves (100 and 40)');
const pieces = blunderPieces([{ row: { color: 'w' }, parsed, analysis }]);
check(pieces[0]?.label === 'Knight', 'the blunder was a knight move');

// time controls
const tcRows = [row('win', 1200, 1200, '2026-11-01', { timeClass: 'bullet' }), row('loss', 1200, 1200, '2026-11-01', { timeClass: 'bullet' }), row('draw', 1200, 1200, '2026-11-01', { timeClass: 'rapid' }), row('win', 1200, 1200, '2026-11-01', { timeClass: 'daily' })];
const acc = new Map([[tcRows[0], 70], [tcRows[1], 80]]);
const tc = byTimeControl(tcRows, (r) => acc.get(r));
check(tc.map((b) => b.label).join() === 'Bullet,Rapid,Daily', 'time controls fastest first, only the ones played');
check(tc[0].score === 50 && tc[0].accuracy === 75 && tc[0].analysed === 2, 'bullet: 50% score, 75 accuracy from two analysed games');
check(tc[1].score === 50 && tc[1].accuracy === null, 'rapid: a draw, no accuracy without analyses');
check(byTimeControl(tcRows)[2].score === 100 && byTimeControl([]).length === 0, 'daily counted; no games gives no buckets');

// puzzle themes
const ts = themeSuccess({ fork: { ok: 2, miss: 4 }, pin: { ok: 5, miss: 1 }, skewer: { ok: 1, miss: 1 }, short: { ok: 0, miss: 9 }, mateIn1: { ok: 2, miss: 4 }, rookEndgame: { ok: 4, miss: 8 } });
check(ts.map((t) => t.theme).join() === 'rookEndgame,fork,mateIn1,pin', 'weakest themes first, more attempts first on a tie, meta tags and tiny samples left out');
check(ts[0].pct === 33 && ts[0].n === 12, 'success rate rounded, attempts counted');
check(themeSuccess({}).length === 0, 'no puzzle results, no rows');
const merged = mergeDocs({ [KEYS.themeResults]: { v: { fork: { ok: 3, miss: 1 }, pin: { ok: 1, miss: 0 } }, t: 1 } }, { [KEYS.themeResults]: { v: { fork: { ok: 1, miss: 1 }, pin: { ok: 2, miss: 2 }, skewer: { ok: 1, miss: 0 } }, t: 2 } });
const mv = merged[KEYS.themeResults]?.v;
check(mv?.fork.ok === 3 && mv?.pin.ok === 2 && mv?.skewer.ok === 1, 'theme results sync: per theme, the copy with more attempts');

console.log(failed ? `\n${failed} failure(s)` : '\nAdvanced stats OK');
process.exit(failed ? 1 : 0);
