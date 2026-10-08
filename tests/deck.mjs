// The review deck: cards in, FSRS scheduling, mixed due order, the old puzzle-review migration, grading from
// results, and merging two devices' decks. Usage: npm run test:deck
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };

const deck = await import('../src/lib/deck.ts');
const { mergeDocs } = await import('../src/lib/sync.ts');
const { AGAIN, GOOD, EASY, HARD, addCard, gradeCard, dueCards, deckStats, gradeFrom, loadDeck } = deck;

let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) failed++;
};
const DAY = 86400_000;
const t0 = new Date(2026, 9, 5, 18, 0).getTime(); // an evening

// the old fixed-interval review queue becomes FSRS cards
store.set('cca-puzzle-review', JSON.stringify({ abc12: { box: 2, due: t0 + 2 * DAY } }));
const migrated = loadDeck()['puzzle:abc12'];
check(migrated && migrated.mem.stability === 7 && migrated.due === t0 + 2 * DAY, 'the old puzzle review queue is carried over (box 3 → 7-day stability, same due date)');
check(JSON.parse(store.get('cca-puzzle-review')) && Object.keys(JSON.parse(store.get('cca-puzzle-review'))).length === 0, '…and emptied, so it isn’t migrated twice');

const missed = addCard({ kind: 'safety', ref: 'q1', title: 'Is Nxe5 safe?', data: { fen: '8/8/8/8/8/8/8/8 w - - 0 1', uci: 'f3e5', verdict: 'unsafe' } }, AGAIN, t0);
check(missed.due === t0 + 10 * 60_000, 'a miss comes back in 10 minutes');
const learned = addCard({ kind: 'lesson', ref: 'forks#0', title: 'Forks' }, GOOD, t0);
check(new Date(learned.due).getDate() === new Date(t0 + 2 * DAY).getDate() && new Date(learned.due).getHours() === 4, 'a first “Good” is due two days later, in the morning');
const fresh = addCard({ kind: 'opening', ref: 'enc-ruy-closed|w', title: 'Ruy Lopez, Closed' }, undefined, t0);
check(fresh.due === t0 && fresh.mem === null, 'a card added without an attempt is due straight away');
const again = addCard({ kind: 'lesson', ref: 'forks#0', title: 'Forks' }, AGAIN, t0 + 3 * DAY);
check(again.reps === 2 && again.lapses === 1 && Object.keys(loadDeck()).filter((k) => k === 'lesson:forks#0').length === 1, 'adding a card that’s already there reviews it (no duplicate), and counts the lapse');

// due order mixes kinds
for (let i = 0; i < 3; i++) addCard({ kind: 'puzzle', ref: `p${i}`, title: 'Puzzle' }, undefined, t0 - (i + 1) * 1000);
addCard({ kind: 'mistake', ref: 'g1', title: 'Your game' }, undefined, t0);
const order = dueCards(t0 + 3 * DAY + 20 * 60_000).map((c) => c.kind);
check(order.slice(0, 4).length === new Set(order.slice(0, 4)).size && order.length === 8, `due cards are dealt out one kind at a time: ${order.join(', ')}`);

const st = deckStats(t0 + 3 * DAY + 20 * 60_000);
check(st.total === 8 && st.due === 8 && st.byKind.puzzle.total === 4, `stats: ${st.total} cards, ${st.due} due, ${st.byKind.puzzle.total} puzzles`);
const later = gradeCard('lesson:forks#0', GOOD, t0 + 3 * DAY + 30 * 60_000);
const reviewedAt = t0 + 3 * DAY + 30 * 60_000;
check(later.due > reviewedAt && new Date(later.due).getDate() === new Date(reviewedAt + DAY).getDate() && new Date(later.due).getHours() === 4, 'relearning it the same day brings it back tomorrow morning');

check(gradeFrom({ correct: false }) === AGAIN && gradeFrom({ correct: true, firstTry: false }) === HARD && gradeFrom({ correct: true }) === GOOD && gradeFrom({ correct: true, seconds: 5 }) === EASY && gradeFrom({ correct: true, sure: false }) === HARD, 'grades: wrong → Again, second try or unsure → Hard, right → Good, quick or sure → Easy');

// two devices' decks merge card by card, the more recent review winning
const a = { 'cca-deck': { v: { 'puzzle:x': { last: 10, added: 1 }, 'puzzle:y': { last: 50, added: 1 } }, t: 1 } };
const b = { 'cca-deck': { v: { 'puzzle:x': { last: 20, added: 1 }, 'puzzle:z': { last: 5, added: 2 } }, t: 2 } };
const m = mergeDocs(a, b)['cca-deck'].v;
check(Object.keys(m).sort().join() === 'puzzle:x,puzzle:y,puzzle:z' && m['puzzle:x'].last === 20, 'two devices’ decks merge: every card kept, the latest review of each wins');

console.log(failed ? `\n${failed} failure(s)` : '\nDeck OK');
process.exit(failed ? 1 : 0);
