// Game analysis that keeps running in the background while you use the rest of the app: Insights queues
// your recent games, and every finished analysis is cached for Game Review and Insights alike.
import { useSyncExternalStore } from 'react';
import { analyzeGame, parseGame, saveCached, savePuzzlesFrom } from './analysis';
import type { GameAnalysis } from './analysis';
import { warmUpPool } from './engine';
import { logActivity } from './activity';

export interface Job {
  url: string; // cache key (the chess.com game url)
  pgn: string;
  color: 'w' | 'b';
  date: number;
  label: string; // "vs opponent"
}

export interface BgState {
  running: boolean;
  done: number;
  total: number;
  label: string;
}

let state: BgState = { running: false, done: 0, total: 0, label: '' };
const queue: Job[] = [];
let ctrl: AbortController | null = null;
const listeners = new Set<() => void>();
const finished = new Set<(url: string, a: GameAnalysis) => void>();

function set(next: Partial<BgState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

/** Adds games to the queue (skipping ones already queued) and starts working through it. */
export function enqueue(jobs: Job[]): void {
  const queued = new Set(queue.map((j) => j.url));
  const fresh = jobs.filter((j) => !queued.has(j.url));
  if (!fresh.length) return;
  queue.push(...fresh);
  set({ total: state.total + fresh.length });
  if (!state.running) void run();
}

export function stop(): void {
  queue.length = 0;
  ctrl?.abort();
  set({ running: false, done: 0, total: 0, label: '' });
}

async function run() {
  warmUpPool();
  set({ running: true });
  while (queue.length) {
    const job = queue[0];
    set({ label: job.label });
    ctrl = new AbortController();
    const parsed = parseGame(job.pgn);
    const a = await analyzeGame(parsed, () => undefined, ctrl.signal).catch(() => null);
    if (ctrl.signal.aborted) return;
    queue.shift();
    if (a) {
      saveCached(job.url, a);
      savePuzzlesFrom(parsed, a, job.color, job.url, job.date);
      logActivity('game');
      finished.forEach((f) => f(job.url, a));
    }
    set({ done: state.done + 1 });
  }
  set({ running: false, done: 0, total: 0, label: '' });
}

/** Called with each analysis as it finishes. */
export function onAnalysed(fn: (url: string, a: GameAnalysis) => void): () => void {
  finished.add(fn);
  return () => finished.delete(fn);
}

export function useBgAnalysis(): BgState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
