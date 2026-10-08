// FSRS-6, the spaced-repetition scheduler by Jarrett Ye (used by Anki), with its published default parameters.
// Each memory has a stability S (days until the chance of recall falls to 90%) and a difficulty D (1–10); a review
// graded Again / Hard / Good / Easy updates both, and the next review is due when recall would drop to 90%.
// Formulas: https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm (see docs/learning-science.md).
// tests/fsrs.mjs checks every step against ts-fsrs, the reference implementation.

export type Grade = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy
export const AGAIN = 1, HARD = 2, GOOD = 3, EASY = 4;

export interface MemoryState {
  stability: number; // days
  difficulty: number; // 1–10
}

/** FSRS-6 default parameters w0…w20 (w20 is the forgetting-curve decay). */
export const W = [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542] as const;
const S_MIN = 0.001;
const S_MAX = 36500;
const DECAY = -W[20];
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1; // makes R(S, S) = 90%
export const RETENTION = 0.9;

const round8 = (x: number) => Math.round(x * 1e8) / 1e8;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Chance of recalling it `days` after the last review. */
export const retrievability = (days: number, stability: number) => round8(Math.pow(1 + (FACTOR * days) / stability, DECAY));

const initStability = (g: Grade) => Math.max(W[g - 1], 0.1);
const initDifficulty = (g: Grade) => round8(W[4] - Math.exp((g - 1) * W[5]) + 1);

function nextDifficulty(d: number, g: Grade) {
  const delta = -W[6] * (g - 3);
  const damped = d + round8((delta * (10 - d)) / 9); // linear damping: harder to move near 10
  return clamp(round8(W[7] * initDifficulty(EASY) + (1 - W[7]) * damped), 1, 10); // mean reversion
}

function recallStability(d: number, s: number, r: number, g: Grade) {
  const hard = g === HARD ? W[15] : 1;
  const easy = g === EASY ? W[16] : 1;
  return round8(clamp(s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * hard * easy), S_MIN, S_MAX));
}

function forgetStability(d: number, s: number, r: number) {
  return round8(clamp(W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]), S_MIN, S_MAX));
}

function shortTermStability(s: number, g: Grade) {
  const inc = Math.pow(s, -W[19]) * Math.exp(W[17] * (g - 3 + W[18]));
  return round8(clamp(s * (g >= HARD ? Math.max(inc, 1) : inc), S_MIN, S_MAX));
}

/**
 * The memory after a review graded `g`, `days` whole days after the previous one (0 = the same day).
 * `prev` is null for the first review.
 */
export function nextState(prev: MemoryState | null, days: number, g: Grade): MemoryState {
  if (!prev) return { difficulty: clamp(initDifficulty(g), 1, 10), stability: initStability(g) };
  const { stability: s, difficulty: d } = prev;
  const r = retrievability(days, s);
  let stability: number;
  if (days === 0) stability = shortTermStability(s, g);
  else if (g === AGAIN) stability = clamp(round8(s / Math.exp(W[17] * W[18])), S_MIN, forgetStability(d, s, r));
  else stability = recallStability(d, s, r, g);
  return { difficulty: nextDifficulty(d, g), stability };
}

/** Days until the next review: when recall would fall to 90%. */
export const nextInterval = (stability: number) => clamp(Math.round(stability), 1, S_MAX);
