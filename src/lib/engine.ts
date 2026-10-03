import { isLegalPosition } from './chess';

export interface EngineLine {
  cp: number | null; // from side-to-move's perspective
  mate: number | null;
  pv: string[]; // UCI moves
}

export interface EngineResult extends EngineLine {
  bestMove: string | null;
  lines: EngineLine[]; // one per MultiPV, best first
}

export class Engine {
  private worker: Worker;
  private ready: Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();
  private multiPv = 1;

  constructor(path = '/stockfish-19-lite-single.js') {
    this.worker = new Worker(path);
    this.ready = new Promise((resolve) => {
      const onMsg = (e: MessageEvent) => {
        if (String(e.data) === 'uciok') {
          this.worker.removeEventListener('message', onMsg);
          resolve();
        }
      };
      this.worker.addEventListener('message', onMsg);
      this.worker.postMessage('uci');
    });
  }

  /**
   * Queues a search. If `signal` aborts before the search starts it is skipped; if it aborts
   * mid-search the engine is told to stop and returns its best result so far.
   */
  analyze(fen: string, depth: number, multiPv = 1, signal?: AbortSignal): Promise<EngineResult> {
    const job = this.queue.then(() => this.ready).then(() => this.run(fen, depth, multiPv, signal));
    this.queue = job.catch(() => undefined);
    return job;
  }

  private run(fen: string, depth: number, multiPv: number, signal?: AbortSignal): Promise<EngineResult> {
    // an impossible position (e.g. a pasted FEN where the side to move can capture the king) crashes the engine
    if (signal?.aborted || !isLegalPosition(fen)) return Promise.resolve({ cp: null, mate: null, pv: [], bestMove: null, lines: [] });
    return new Promise((resolve) => {
      const lines: EngineLine[] = [];
      const stop = () => this.worker.postMessage('stop');
      // watchdog: never let one search block the queue forever
      const watchdog = setTimeout(stop, 30_000);
      const hardLimit = setTimeout(() => finish(null), 35_000);
      signal?.addEventListener('abort', stop);
      const finish = (move: string | null) => {
        clearTimeout(watchdog);
        clearTimeout(hardLimit);
        signal?.removeEventListener('abort', stop);
        this.worker.removeEventListener('message', onMsg);
        const top = lines[0] ?? { cp: null, mate: null, pv: [] };
        resolve({ ...top, bestMove: move, lines: lines.filter(Boolean) });
      };
      const onMsg = (e: MessageEvent) => {
        const line = String(e.data);
        if (line.startsWith('info') && line.includes(' score ') && !/lowerbound|upperbound/.test(line)) {
          const idx = Number(line.match(/ multipv (\d+)/)?.[1] ?? 1) - 1;
          const cp = line.match(/score cp (-?\d+)/);
          const mate = line.match(/score mate (-?\d+)/);
          lines[idx] = {
            cp: cp ? Number(cp[1]) : null,
            mate: mate ? Number(mate[1]) : null,
            pv: line.match(/ pv (.+)$/)?.[1].split(' ') ?? [],
          };
        } else if (line.startsWith('bestmove')) {
          const move = line.split(' ')[1];
          finish(move && move !== '(none)' ? move : null);
        }
      };
      this.worker.addEventListener('message', onMsg);
      if (multiPv !== this.multiPv) {
        this.worker.postMessage(`setoption name MultiPV value ${multiPv}`);
        this.multiPv = multiPv;
      }
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go depth ${depth}`);
    });
  }
}

let instance: Engine | null = null;
/** The interactive engine (analysis board). Kept separate from the pool so it never waits behind a game review. */
export function getEngine(): Engine {
  if (!instance) instance = new Engine();
  return instance;
}

// ── Engine pool for game reviews: several single-threaded engines analysing different positions at once ──

function poolSize(): number {
  const cores = navigator.hardwareConcurrency || 4;
  const memoryGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return Math.max(2, Math.min(cores - 2, memoryGb <= 4 ? 3 : 8));
}

let pool: Engine[] | null = null;
function getPool(): Engine[] {
  if (!pool) pool = Array.from({ length: poolSize() }, () => new Engine());
  return pool;
}

/** Starts the review engines early (e.g. when the game list opens) so the first review starts instantly. */
export function warmUpPool(): void {
  getPool();
}

/**
 * Analyses many positions in parallel across the pool. Each result is reported as soon as it is ready;
 * the promise resolves when every position is done (or the signal aborts).
 */
export async function analyzeMany(
  fens: string[],
  indices: number[],
  depth: number,
  multiPv: number,
  onResult: (index: number, result: EngineResult) => void,
  signal?: AbortSignal,
): Promise<void> {
  let next = 0;
  await Promise.all(
    getPool().map(async (engine) => {
      while (next < indices.length && !signal?.aborted) {
        const i = indices[next++];
        const r = await engine.analyze(fens[i], depth, multiPv, signal);
        if (!signal?.aborted) onResult(i, r);
      }
    }),
  );
}
