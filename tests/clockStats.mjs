// The clock and tilt coach's numbers: time used, fast moves and losing streaks, on hand-made games with known
// answers, plus a run over real chess.com games when a username is given.
// Usage: npm run test:clock [-- <chess.com username>]
import { clockSummary, gameClock, tiltCheck } from '../src/lib/clockStats.ts';

let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) failed++;
};
const clk = (s) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
/** A 10-minute game where I (White) spend `mine` seconds per move and the opponent 10. */
function game(mine, { outcome = 'loss', end = 1_790_000_000, user = 'me' } = {}) {
  let w = 600, b = 600, pgn = '';
  mine.forEach((s, i) => {
    w -= s;
    b -= 10;
    pgn += `${i + 1}. e4 {[%clk ${clk(w)}]} ${i + 1}... e5 {[%clk ${clk(b)}]} `;
  });
  return { url: `g${end}`, pgn, time_control: '600', time_class: 'rapid', end_time: end, rated: true, rules: 'chess', white: { username: user, rating: 700, result: outcome === 'win' ? 'win' : outcome === 'draw' ? 'agreed' : 'checkmated' }, black: { username: 'opp', rating: 700, result: outcome === 'win' ? 'checkmated' : outcome === 'draw' ? 'agreed' : 'win' } };
}

const g1 = gameClock(game([2, 3, 4, 30, 60, 1]), 'me');
check(g1.used === 100 && g1.moves === 6 && g1.fast === 4, `time used and fast moves in one game (${g1.used}s, ${g1.fast}/${g1.moves} under 5 s)`);
check(g1.usedPct === 17, `share of the clock used (${g1.usedPct}%)`);
const now = 1_790_000_000 * 1000 + 3600_000;
const sum = clockSummary([game([2, 3, 4, 30, 60, 1]), game(Array(10).fill(40), { end: 1_789_990_000 })], 'me', 'rapid', 7, now);
check(sum.games === 2 && sum.usedPct === Math.round((17 + 67) / 2) && sum.fastShare === 25, `weekly summary (${sum.usedPct}% used, ${sum.fastShare}% fast)`);
check(!sum.usedOk && !sum.fastOk, 'both goals missed are reported as missed');

const t0 = 1_790_000_000;
const streak = tiltCheck([game([10], { outcome: 'win', end: t0 - 7200 }), game([10], { end: t0 - 1800 }), game([10], { end: t0 - 600 })], 'me', (t0 + 300) * 1000);
check(streak.streak === 2 && streak.stop, `two losses in a row within the hour: time for a break (${streak.streak} losses, ${streak.minutesAgo} min ago)`);
const calm = tiltCheck([game([10], { end: t0 - 600 }), game([10], { outcome: 'win', end: t0 - 300 })], 'me', (t0 + 300) * 1000);
check(calm.streak === 0 && !calm.stop, 'after a win there is no warning');
const old = tiltCheck([game([10], { end: t0 - 9000 }), game([10], { end: t0 - 8000 })], 'me', (t0 + 300) * 1000);
check(old.streak === 2 && !old.stop, 'old losses don’t trigger a warning');

const user = process.argv[2];
if (user) {
  const months = (await (await fetch(`https://api.chess.com/pub/player/${user}/games/archives`)).json()).archives.slice(-2);
  const games = (await Promise.all(months.map(async (u) => (await (await fetch(u)).json()).games))).flat();
  const s = clockSummary(games, user, 'rapid', 60);
  const t = tiltCheck(games, user);
  console.log(`\n${user}, rapid, last 60 days: ${s?.games} games, ${s?.usedMin} of ${s?.baseMin} min used (${s?.usedPct}%), ${s?.fastShare}% of moves under 5 s`);
  console.log(`after a loss: ${JSON.stringify(t?.afterLoss)} · after a win: ${JSON.stringify(t?.afterWin)} · current losing streak ${t?.streak}`);
}
console.log(failed ? `\n${failed} failure(s)` : '\nClock stats OK');
process.exit(failed ? 1 : 0);
