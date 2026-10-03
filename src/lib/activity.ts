// What you trained each day, for the daily plan and the streak.
import { KEYS, load, save } from './storage';

export type ActivityKind = 'puzzle' | 'puzzleSolved' | 'review' | 'lesson' | 'drill' | 'game' | 'vision' | 'opening';
type Day = Partial<Record<ActivityKind, number>>;

export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function logActivity(kind: ActivityKind, n = 1) {
  const all = load<Record<string, Day>>(KEYS.activity, {});
  const day = (all[today()] ??= {});
  day[kind] = (day[kind] ?? 0) + n;
  save(KEYS.activity, all);
  window.dispatchEvent(new Event('cca-activity'));
}

export function activityOn(date: string): Day {
  return load<Record<string, Day>>(KEYS.activity, {})[date] ?? {};
}

/** Consecutive days (ending today, or yesterday if today has nothing yet) with any training. */
export function streak(): number {
  const all = load<Record<string, Day>>(KEYS.activity, {});
  const active = (d: Date) => Object.values(all[today(d)] ?? {}).some((v) => (v ?? 0) > 0);
  const d = new Date();
  if (!active(d)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (active(d)) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** The last `days` days, oldest first, for the activity strip. */
export function recentDays(days: number): { date: string; total: number }[] {
  const all = load<Record<string, Day>>(KEYS.activity, {});
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = today(d);
    out.push({ date: key, total: Object.values(all[key] ?? {}).reduce((a: number, b) => a + (b ?? 0), 0) });
  }
  return out;
}

/** "just now", "5 min ago", "3 h ago", then the date. */
export function ago(t: number): string {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
