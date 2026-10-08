import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board } from '../components/Board';
import { logActivity } from '../lib/activity';
import type { Puzzle as GamePuzzle } from '../lib/analysis';
import { getEngine } from '../lib/engine';
import { fetchPuzzle, getRating } from '../lib/puzzles';
import { afterMove, explainSafe, explainUnsafe, sanOf, temptingMoves, verdictOf } from '../lib/safety';
import { KEYS, load, save } from '../lib/storage';
import { playSound } from '../lib/sound';
import { AGAIN, addCard } from '../lib/deck';
import { useFitTop } from '../lib/useFitTop';

const ROUND = 10;
const DEPTH = 12;

interface Question {
  fen: string;
  uci: string;
  san: string;
  verdict: 'safe' | 'unsafe';
  explain: string;
  reply: string | null; // the opponent's best answer (shown when the move isn't safe)
  source: string; // where the position comes from
}

interface Stats {
  total: number;
  correct: number;
  best: number; // best streak
}

const loadStats = (): Stats => ({ total: 0, correct: 0, best: 0, ...load<Partial<Stats>>(KEYS.safety, {}) });

/**
 * A position and a move to judge, verified by Stockfish: about half are safe, half are not. Positions come from
 * the mistakes in your own reviewed games and from easy Lichess puzzles (whose first move is a real blunder).
 */
async function makeQuestion(signal: AbortSignal, want: 'safe' | 'unsafe'): Promise<Question> {
  const engine = getEngine();
  const mine = load<GamePuzzle[]>(KEYS.puzzles, []);
  for (let attempt = 0; attempt < 6; attempt++) {
    if (signal.aborted) throw new Error('aborted');
    const wantUnsafe = want === 'unsafe';
    let fen: string;
    let first: string | undefined;
    let source: string;
    if (mine.length && Math.random() < 0.35) {
      const p = mine[Math.floor(Math.random() * Math.min(mine.length, 60))];
      fen = p.fen;
      try {
        const m = new Chess(p.fen).move(p.playedSan);
        first = m.from + m.to + (m.promotion ?? '');
      } catch {
        continue;
      }
      source = `From your game${p.date ? ` on ${new Date(p.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}`;
    } else {
      const rating = Math.max(600, Math.min(1300, getRating().rating - 250)) + Math.round((Math.random() - 0.5) * 300);
      const p = await fetchPuzzle(rating);
      fen = p.fen;
      first = p.moves[0]; // in a Lichess puzzle the first move is the blunder that allows the tactic
      source = 'From a real game on Lichess';
    }
    const best = await engine.analyze(fen, DEPTH, 1, signal);
    // a safe one: tempting moves first, and Stockfish's own move last (it's safe by definition)
    const cands = wantUnsafe
      ? temptingMoves(fen, first).slice(0, 5)
      : [...temptingMoves(fen).filter((u) => u !== first && u !== best.bestMove).slice(0, 4), ...(best.bestMove ? [best.bestMove] : [])];
    // keep the first clear answer of each kind; use the other kind rather than throwing a good position away
    const found: Partial<Record<'safe' | 'unsafe', Question>> = {};
    for (const uci of cands) {
      const after = await engine.analyze(afterMove(fen, uci), DEPTH, 1, signal);
      const { verdict } = verdictOf(best, after);
      if (verdict === 'unclear' || found[verdict]) continue;
      found[verdict] = {
        fen,
        uci,
        san: sanOf(fen, uci),
        verdict,
        explain: verdict === 'unsafe' ? explainUnsafe(fen, uci, after.bestMove, after.pv.slice(1), after.mate) : explainSafe(fen, uci),
        reply: after.bestMove,
        source,
      };
      if (found[wantUnsafe ? 'unsafe' : 'safe']) break;
    }
    const q = found[wantUnsafe ? 'unsafe' : 'safe'] ?? found.safe ?? found.unsafe;
    if (q) return q;
  }
  throw new Error('Couldn’t find a position. Check your connection and try again.');
}

export function SafetyDrill() {
  const fitRef = useFitTop<HTMLDivElement>();
  const [stats, setStats] = useState(loadStats);
  const [streak, setStreak] = useState(0);
  const [q, setQ] = useState<Question | null>(null);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState<'safe' | 'unsafe' | null>(null);
  const [shownFen, setShownFen] = useState<string | null>(null);
  const [round, setRound] = useState<{ q: Question; right: boolean }[]>([]);
  const [summary, setSummary] = useState(false); // the round's results (after the last answer has been read)
  const next = useRef<Promise<Question> | null>(null);
  // safe and unsafe come up about equally often, so “Not safe” every time can't score
  const served = useRef({ safe: 0, unsafe: 0 });
  const nextWant = (): 'safe' | 'unsafe' => {
    const { safe, unsafe } = served.current;
    if (Math.abs(safe - unsafe) >= 2) return safe < unsafe ? 'safe' : 'unsafe';
    return Math.random() < 0.5 ? 'safe' : 'unsafe';
  };
  const ask = (sig: AbortSignal) =>
    makeQuestion(sig, nextWant()).then((question) => {
      served.current[question.verdict]++;
      return question;
    });
  const signal = useRef<AbortSignal>(new AbortController().signal); // replaced on mount; leaving the page stops the engine work

  const timers = useRef<number[]>([]);
  const load_ = useCallback(async () => {
    const sig = signal.current;
    timers.current.forEach(clearTimeout); // the last answer's replay mustn't land on the new position
    timers.current = [];
    setError('');
    setQ(null);
    setAnswer(null);
    setShownFen(null);
    try {
      const question = await (next.current ?? ask(sig));
      if (sig.aborted) return;
      next.current = ask(sig); // the next one is ready by the time you answer
      next.current.catch(() => undefined);
      setQ(question);
    } catch (e) {
      next.current = null;
      if (!sig.aborted) setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    const c = new AbortController();
    signal.current = c.signal;
    next.current = null;
    void load_();
    return () => c.abort();
  }, [load_]);

  const decide = useCallback(
    (a: 'safe' | 'unsafe') => {
      if (!q || answer) return;
      const right = a === q.verdict;
      setAnswer(a);
      playSound(right ? 'correct' : 'wrong');
      const s = right ? streak + 1 : 0;
      setStreak(s);
      const st = { total: stats.total + 1, correct: stats.correct + (right ? 1 : 0), best: Math.max(stats.best, s) };
      setStats(st);
      save(KEYS.safety, st);
      logActivity('safety');
      setRound((r) => [...r, { q, right }]);
      // a miss joins your review deck: it comes back in a few minutes and again tomorrow
      if (!right) addCard({ kind: 'safety', ref: `${q.fen.split(' ').slice(0, 2).join('_')}|${q.uci}`, title: `Is ${q.san} safe?`, data: { fen: q.fen, uci: q.uci, verdict: q.verdict, reply: q.reply ?? undefined, explain: q.explain, source: q.source } }, AGAIN);
      // play it out: the move, then (if it wasn't safe) the answer that punishes it
      const after = afterMove(q.fen, q.uci);
      timers.current.push(window.setTimeout(() => setShownFen(after), 450));
      if (q.verdict === 'unsafe' && q.reply) timers.current.push(window.setTimeout(() => setShownFen(afterMove(after, q.reply!)), 1350));
    },
    [q, answer, streak, stats],
  );

  const roundDone = summary;
  const lastOfRound = round.length >= ROUND;
  const advance = useCallback(() => (round.length >= ROUND ? setSummary(true) : void load_()), [round.length, load_]);
  // keys: S safe, N not safe, Enter next. The listener is registered once and reads the latest state, updated
  // as soon as a render commits, so a key pressed the moment a position appears still counts.
  const latest = useRef({ q, answer, roundDone, decide, advance });
  useLayoutEffect(() => {
    latest.current = { q, answer, roundDone, decide, advance };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      const { q: cur, answer: ans, roundDone: over, decide: judge, advance: more } = latest.current;
      if (cur && !ans && (e.key === 's' || e.key === 'S')) judge('safe');
      if (cur && !ans && (e.key === 'n' || e.key === 'N')) judge('unsafe');
      if (ans && !over && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        more();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const arrows = useMemo(() => (q && !shownFen ? [[q.uci, 'rgba(255,170,0,0.85)'] as [string, string]] : []), [q, shownFen]);
  const orientation = q?.fen.split(' ')[1] === 'b' ? 'black' : 'white';
  const accuracy = stats.total ? Math.round((stats.correct / stats.total) * 100) : null;
  const right = answer && q ? answer === q.verdict : null;

  return (
    <div className="puzzle-play safety" ref={fitRef} data-q={q ? `${q.fen}|${q.uci}` : undefined} data-verdict={answer ? q?.verdict : undefined}>
      <div className="puzzle-board">
        {q ? (
          <Board id="safety-board" fen={shownFen ?? q.fen} orientation={orientation} arrows={arrows} maxWidth={600} />
        ) : (
          <div className="board-placeholder">
            {error ? (
              <>
                <div className="error">{error}</div>
                <button className="btn-secondary" onClick={() => void load_()}>Try again</button>
              </>
            ) : (
              <><span className="spinner" /><span className="muted">Finding a position…</span></>
            )}
          </div>
        )}
      </div>
      <div className="puzzle-side panel">
        <div className="safety-stats">
          <div><b>{streak}</b><span>streak</span></div>
          <div><b>{stats.best}</b><span>best streak</span></div>
          <div><b>{accuracy === null ? '–' : `${accuracy}%`}</b><span>right ({stats.total})</span></div>
        </div>
        <div className="quick-progress" aria-label={`Position ${Math.min(round.length + (answer ? 0 : 1), ROUND)} of ${ROUND}`}>
          {Array.from({ length: ROUND }, (_, i) => <span key={i} className={i < round.length ? (round[i].right ? 'done' : 'missed') : i === round.length ? 'on' : ''} />)}
        </div>

        {roundDone ? (
          <div className="safety-summary">
            <h3>{round.filter((r) => r.right).length} of {ROUND} right</h3>
            {round.some((r) => !r.right) ? (
              <>
                <div className="eyebrow">The ones you missed</div>
                <ul className="quick-rules">
                  {round.filter((r) => !r.right).map((r, i) => (
                    <li key={i}><b>{r.q.san}</b> was {r.q.verdict === 'safe' ? 'safe' : 'not safe'}: {r.q.explain}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted">A perfect round. That’s the check that keeps pieces on the board.</p>
            )}
            <button className="btn-green" onClick={() => { setRound([]); setSummary(false); void load_(); }}>Another {ROUND}</button>
          </div>
        ) : q && !answer ? (
          <>
            <div className="safety-ask">
              You’re about to play <b className="safety-move">{q.san}</b> (the orange arrow). Is it safe?
            </div>
            <p className="muted small">Ask yourself: can that piece be taken? What did it defend before it moved? Does it allow a check or a double attack?</p>
            <div className="safety-buttons">
              <button className="btn-green" onClick={() => decide('safe')}>✓ Safe <kbd>S</kbd></button>
              <button className="btn-danger" onClick={() => decide('unsafe')}>✗ Not safe <kbd>N</kbd></button>
            </div>
          </>
        ) : q && answer ? (
          <>
            <div className={`quick-result ${right ? 'good' : 'bad'}`}>
              <b>{right ? '✓ Right!' : '✗ Not quite.'} {q.san} is {q.verdict === 'safe' ? 'safe' : 'not safe'}.</b>
            </div>
            <p className="quick-explain">{q.explain}</p>
            <div className="muted small">{q.source}</div>
            <button className="btn-green wide" onClick={advance}>{lastOfRound ? 'See results →' : 'Next position →'} <kbd>Enter</kbd></button>
          </>
        ) : (
          <div className="muted">{error || 'Finding a position…'}</div>
        )}
      </div>
    </div>
  );
}
