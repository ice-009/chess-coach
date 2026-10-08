// Your review deck: every position you got wrong (and the lines and lesson exercises you learned) comes back just
// before you'd forget it, scheduled by FSRS (./fsrs.ts). One deck for everything, reviewed mixed together: mixing
// kinds of problems helps you recognise which idea a position needs (interleaving; docs/learning-science.md).
import { AGAIN, EASY, GOOD, HARD, nextInterval, nextState, retrievability } from './fsrs.ts';
import type { Grade, MemoryState } from './fsrs.ts';
import { KEYS, load, save } from './storage.ts';

export type CardKind = 'puzzle' | 'mistake' | 'safety' | 'opening' | 'lesson';
export { AGAIN, EASY, GOOD, HARD };
export type { Grade };

/** What a card asks, for kinds that aren't looked up elsewhere (a puzzle by id, a lesson exercise, an opening line). */
export interface CardData {
  fen?: string;
  uci?: string; // the move to judge (safety) or the move you played (mistake)
  best?: string; // UCI of the best move (mistake)
  verdict?: 'safe' | 'unsafe';
  reply?: string; // UCI: the opponent's best answer (safety: what punishes an unsafe move)
  explain?: string;
  source?: string; // "From your game vs …"
}

export interface Card {
  id: string; // `${kind}:${ref}`
  kind: CardKind;
  ref: string;
  title: string;
  data?: CardData;
  added: number;
  mem: MemoryState | null; // null until the first review
  last: number; // last review (ms), 0 = never
  due: number; // ms
  reps: number;
  lapses: number;
}

type Deck = Record<string, Card>;
const DAY = 86400_000;
export const KIND_LABEL: Record<CardKind, string> = {
  puzzle: 'Puzzles',
  mistake: 'Your mistakes',
  safety: 'Is it safe?',
  opening: 'Openings',
  lesson: 'Lessons',
};

/** Whole local calendar days between two moments (what FSRS counts as "days since the last review"). */
export function daysBetween(a: number, b: number): number {
  const day = (t: number) => {
    const d = new Date(t);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  };
  return Math.max(0, Math.round((day(b) - day(a)) / DAY));
}
/** Start of the local day `days` from `t`: reviews fall due in the morning, not at the minute you last saw them. */
function morning(t: number, days: number): number {
  const d = new Date(t);
  d.setHours(4, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export const loadDeck = (): Deck => {
  migrateOldReviews();
  return load<Deck>(KEYS.deck, {});
};
const saveDeck = (d: Deck) => save(KEYS.deck, d);

/** The card after a review graded `g` at `now`. "Again" brings it back in ten minutes (and in the next session). */
export function reviewed(card: Card, g: Grade, now = Date.now()): Card {
  const days = card.last ? daysBetween(card.last, now) : 0;
  const mem = nextState(card.mem, days, g);
  return {
    ...card,
    mem,
    last: now,
    reps: card.reps + 1,
    lapses: card.lapses + (g === AGAIN && card.reps > 0 ? 1 : 0),
    due: g === AGAIN ? now + 10 * 60_000 : morning(now, nextInterval(mem.stability)),
  };
}

/**
 * Puts a position in the deck (once). With a grade, that first attempt counts as its first review; without one it
 * is due straight away. Adding a card that's already in the deck reviews it instead.
 */
export function addCard(card: { kind: CardKind; ref: string; title: string; data?: CardData }, grade?: Grade, now = Date.now()): Card {
  const deck = loadDeck();
  const id = `${card.kind}:${card.ref}`;
  const existing = deck[id];
  let next: Card;
  if (existing) next = grade ? reviewed(existing, grade, now) : existing;
  else {
    const fresh: Card = { ...card, id, added: now, mem: null, last: 0, due: now, reps: 0, lapses: 0 };
    next = grade ? reviewed(fresh, grade, now) : fresh;
  }
  deck[id] = next;
  saveDeck(deck);
  return next;
}

export function gradeCard(id: string, g: Grade, now = Date.now()): Card | null {
  const deck = loadDeck();
  if (!deck[id]) return null;
  deck[id] = reviewed(deck[id], g, now);
  saveDeck(deck);
  return deck[id];
}

export function removeCard(id: string) {
  const deck = loadDeck();
  delete deck[id];
  saveDeck(deck);
}

export const getCard = (id: string): Card | undefined => loadDeck()[id];

/** Cards due now, oldest first within each kind, then dealt out one kind at a time so the review is mixed. */
export function dueCards(now = Date.now(), deck = loadDeck()): Card[] {
  const due = Object.values(deck).filter((c) => c.due <= now).sort((a, b) => a.due - b.due);
  const byKind = new Map<CardKind, Card[]>();
  for (const c of due) byKind.set(c.kind, [...(byKind.get(c.kind) ?? []), c]);
  const piles = [...byKind.values()];
  const out: Card[] = [];
  while (piles.some((p) => p.length)) for (const p of piles) if (p.length) out.push(p.shift()!);
  return out;
}

export const dueCount = (now = Date.now()) => Object.values(loadDeck()).filter((c) => c.due <= now).length;

export interface DeckStats {
  total: number;
  due: number;
  byKind: Record<CardKind, { total: number; due: number }>;
  nextDue: number | null; // the soonest future review
  retention: number | null; // average chance of recalling what you've reviewed, right now (0–100)
}

export function deckStats(now = Date.now(), deck = loadDeck()): DeckStats {
  const cards = Object.values(deck);
  const byKind = Object.fromEntries((Object.keys(KIND_LABEL) as CardKind[]).map((k) => [k, { total: 0, due: 0 }])) as DeckStats['byKind'];
  let due = 0;
  let nextDue: number | null = null;
  let rSum = 0;
  let rN = 0;
  for (const c of cards) {
    byKind[c.kind].total++;
    if (c.due <= now) {
      due++;
      byKind[c.kind].due++;
    } else if (nextDue === null || c.due < nextDue) nextDue = c.due;
    if (c.mem && c.last) {
      rSum += retrievability(Math.max(0, (now - c.last) / DAY), c.mem.stability);
      rN++;
    }
  }
  return { total: cards.length, due, byKind, nextDue, retention: rN ? Math.round((rSum / rN) * 100) : null };
}

/** How a review went, as an FSRS grade: wrong = Again, right after a slip = Hard, right = Good, right and quick = Easy. */
export function gradeFrom(result: { correct: boolean; firstTry?: boolean; seconds?: number; sure?: boolean }): Grade {
  if (!result.correct) return AGAIN;
  if (result.firstTry === false) return HARD;
  if (result.sure === false) return HARD;
  if ((result.seconds !== undefined && result.seconds <= 8) || result.sure === true) return EASY;
  return GOOD;
}

// The old puzzle review (fixed 1, 3, 7, 21-day boxes) becomes FSRS cards, once.
let migrated = false;
function migrateOldReviews() {
  if (migrated) return;
  migrated = true;
  const old = load<Record<string, { box: number; due: number }> | null>(KEYS.puzzleReview, null);
  if (!old || !Object.keys(old).length) return;
  const deck = load<Deck>(KEYS.deck, {});
  const now = Date.now();
  for (const [ref, r] of Object.entries(old)) {
    const id = `puzzle:${ref}`;
    if (deck[id]) continue;
    const stability = [1, 3, 7, 21][Math.min(3, Math.max(0, r.box))];
    deck[id] = { id, kind: 'puzzle', ref, title: 'Puzzle you missed', added: now, mem: { stability, difficulty: 6 }, last: r.due - stability * DAY, due: r.due, reps: r.box + 1, lapses: 0 };
  }
  save(KEYS.deck, deck);
  save(KEYS.puzzleReview, {});
}
