// What Quick Review found in each game you reviewed, so the dashboard can tell you which mistake costs you the
// most (and the habit that fixes it). Synced with your account.
import { KEYS, load, save } from './storage';
import { RULES, TYPE_LABEL } from './keyMoments';
import type { KeyMoment, MistakeType } from './keyMoments';

export interface QuickResult {
  date: number;
  types: MistakeType[]; // one per key moment
  found: number; // moments where you found a good move yourself
  total: number;
}

export const loadQuickReviews = () => load<Record<string, QuickResult>>(KEYS.quickReviews, {});

export function recordQuickReview(gameKey: string, moments: KeyMoment[], found: number) {
  save(KEYS.quickReviews, { ...loadQuickReviews(), [gameKey]: { date: Date.now(), types: moments.map((m) => m.type), found, total: moments.length } });
}

/** Your most frequent kind of mistake in the games you quick-reviewed in the last `days` days. */
export function commonMistake(days = 30): { type: MistakeType; label: string; rule: string; count: number; games: number } | null {
  const since = Date.now() - days * 86400_000;
  const recent = Object.values(loadQuickReviews()).filter((r) => r.date >= since);
  const counts = new Map<MistakeType, number>();
  for (const r of recent) for (const t of r.types) if (t !== 'other') counts.set(t, (counts.get(t) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? { type: top[0], label: TYPE_LABEL[top[0]], rule: RULES[top[0]], count: top[1], games: recent.length } : null;
}
