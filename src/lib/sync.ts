// Which saved progress follows your account, and how two devices' copies are combined.
// Most keys merge (lessons done on the iPad and on the laptop both count); the rest keep the newer copy.
import { KEYS } from './storage.ts';

/** One synced value and when it last changed on the device that wrote it. */
export interface Entry {
  v: unknown;
  t: number;
}
export type SyncDoc = Record<string, Entry>;

type Rec<T> = Record<string, T>;
const maxPerKey = (a: Rec<number>, b: Rec<number>) => {
  const out = { ...a };
  for (const [k, n] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, n);
  return out;
};
const newer = (a: Entry, b: Entry) => (b.t > a.t ? b.v : a.v);

type ById = { id: string; date: number };
type Rating = { rating: number; games: number; history: { t: number }[] };
type Day = Rec<number>;
type Quiz = Rec<Partial<Rec<{ date: number }>>>;

/** How each synced key combines two copies (`a` is this device's). Keys without one keep the newer copy. */
const MERGE: Record<string, (a: Entry, b: Entry) => unknown> = {
  [KEYS.lessonsDone]: (a, b) => [...new Set([...(a.v as string[]), ...(b.v as string[])])],
  [KEYS.openingsDone]: (a, b) => maxPerKey(a.v as Rec<number>, b.v as Rec<number>),
  [KEYS.drillsDone]: (a, b) => maxPerKey(a.v as Rec<number>, b.v as Rec<number>),
  [KEYS.visionBest]: (a, b) => maxPerKey(a.v as Rec<number>, b.v as Rec<number>),
  [KEYS.rushBest]: (a, b) => Math.max(Number(a.v) || 0, Number(b.v) || 0),
  [KEYS.puzzlesSolved]: (a, b) => {
    const out = { ...(a.v as Rec<boolean>) };
    for (const [k, ok] of Object.entries(b.v as Rec<boolean>)) out[k] = !!out[k] || ok;
    return out;
  },
  // puzzles made from your mistakes: every one from both devices, newest first
  [KEYS.puzzles]: (a, b) => {
    const seen = new Set<string>();
    return [...(a.v as ById[]), ...(b.v as ById[])].filter((p) => !seen.has(p.id) && !!seen.add(p.id)).sort((x, y) => y.date - x.date).slice(0, 800);
  },
  [KEYS.accuracy]: (a, b) => Object.fromEntries(Object.entries({ ...(b.v as Rec<unknown>), ...(a.v as Rec<unknown>) }).slice(-2000)),
  // a rating can't be added up: keep the copy with more puzzles played
  [KEYS.puzzleRating]: (a, b) => {
    const [x, y] = [a.v as Rating, b.v as Rating];
    const last = (r: Rating) => r.history.at(-1)?.t ?? 0;
    return y.games > x.games || (y.games === x.games && last(y) > last(x)) ? y : x;
  },
  [KEYS.activity]: (a, b) => {
    const out: Rec<Day> = { ...(a.v as Rec<Day>) };
    for (const [day, kinds] of Object.entries(b.v as Rec<Day>)) out[day] = maxPerKey(out[day] ?? {}, kinds);
    return out;
  },
  [KEYS.openingQuiz]: (a, b) => {
    const out: Quiz = { ...(a.v as Quiz) };
    for (const [line, byColor] of Object.entries(b.v as Quiz)) {
      const mine = { ...out[line] };
      for (const [c, r] of Object.entries(byColor)) if (r && (!mine[c] || r.date > mine[c]!.date)) mine[c] = r;
      out[line] = mine;
    }
    return out;
  },
};

/** Progress that follows your account. (Seen-puzzle lists and game analyses stay on each device.) */
export const SYNCED: string[] = [KEYS.me, KEYS.puzzleReview, ...Object.keys(MERGE)];

/** Combines this device's copy with the account's. */
export function mergeDocs(local: SyncDoc, remote: SyncDoc): SyncDoc {
  const out: SyncDoc = {};
  for (const key of SYNCED) {
    const [a, b] = [local[key], remote[key]];
    if (!a || !b) {
      if (a ?? b) out[key] = (a ?? b)!;
      continue;
    }
    let v: unknown;
    try {
      v = MERGE[key] ? MERGE[key](a, b) : newer(a, b);
    } catch {
      v = newer(a, b); // a copy in an unexpected shape: keep the newer one
    }
    out[key] = { v, t: Math.max(a.t, b.t) };
  }
  return out;
}
