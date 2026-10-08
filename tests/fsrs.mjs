// The FSRS-6 scheduler matches ts-fsrs (the reference implementation by the FSRS authors) step by step, and behaves
// the way spaced repetition should. Usage: npm run test:fsrs
import { FSRSAlgorithm, generatorParameters } from 'ts-fsrs';
import { AGAIN, EASY, GOOD, HARD, nextInterval, nextState, retrievability } from '../src/lib/fsrs.ts';

let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) failed++;
};
const ref = new FSRSAlgorithm(generatorParameters({ enable_fuzz: false, enable_short_term: true }));

// 1. random review histories: every state and interval agrees with the reference
let rng = 42;
const rand = () => ((rng = (rng * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
let steps = 0, worst = 0;
for (let h = 0; h < 300; h++) {
  let mine = null, theirs = null;
  for (let i = 0; i < 12; i++) {
    const g = [AGAIN, HARD, GOOD, EASY][Math.floor(rand() * 4)];
    const days = i === 0 ? 0 : Math.floor(rand() * (rand() < 0.2 ? 1 : 60)); // some same-day reviews
    mine = nextState(mine, days, g);
    theirs = ref.next_state(theirs, days, g);
    worst = Math.max(worst, Math.abs(mine.stability - theirs.stability) / theirs.stability, Math.abs(mine.difficulty - theirs.difficulty));
    if (nextInterval(mine.stability) !== ref.next_interval(theirs.stability, days)) worst = Infinity;
    steps++;
  }
}
check(worst < 1e-6, `${steps} random reviews match ts-fsrs (largest difference ${worst.toExponential(1)})`);

// 2. the behaviour spaced repetition is supposed to have
check(Math.abs(retrievability(7, 7) - 0.9) < 1e-6, 'after S days the chance of recall is exactly 90%');
const first = (g) => nextInterval(nextState(null, 0, g).stability);
check(first(AGAIN) < first(HARD) || first(AGAIN) === 1, `a first “Again” comes back soonest (${first(AGAIN)} day)`);
check(first(HARD) < first(GOOD) && first(GOOD) < first(EASY), `first intervals grow with the grade: hard ${first(HARD)}, good ${first(GOOD)}, easy ${first(EASY)} days`);
let s = nextState(null, 0, GOOD);
const goods = [nextInterval(s.stability)];
for (let i = 0; i < 4; i++) {
  s = nextState(s, goods[goods.length - 1], GOOD);
  goods.push(nextInterval(s.stability));
}
check(goods.every((x, i) => i === 0 || x > goods[i - 1]), `remembering it again and again spaces it out: ${goods.join(' → ')} days`);
const lapse = nextState(s, goods[goods.length - 1], AGAIN);
check(lapse.stability < s.stability / 3, `forgetting it brings it back soon (stability ${s.stability.toFixed(0)} → ${lapse.stability.toFixed(1)} days)`);
const hardItem = [GOOD, AGAIN, AGAIN].reduce((m, g, i) => nextState(m, i ? 3 : 0, g), null);
const easyItem = [GOOD, GOOD, GOOD].reduce((m, g, i) => nextState(m, i ? 3 : 0, g), null);
check(hardItem.difficulty > easyItem.difficulty, `items you keep missing count as harder (difficulty ${hardItem.difficulty.toFixed(1)} vs ${easyItem.difficulty.toFixed(1)})`);

console.log(failed ? `\n${failed} failure(s)` : '\nFSRS OK');
process.exit(failed ? 1 : 0);
