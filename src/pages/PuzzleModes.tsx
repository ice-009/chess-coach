import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  THEMES,
  buildPuzzles,
  fetchPuzzle,
  getRating,
  markSeen,
  puzzleStatus,
  scheduleReview,
  themeInfo,
  themeLabel,
  updateRating,
} from '../lib/puzzles';
import type { Puzzle, PuzzleStatus } from '../lib/puzzles';
import { logActivity } from '../lib/activity';
import { countThemeSolve } from '../lib/courses';
import { KEYS, load, save } from '../lib/storage';
import { navigate } from '../lib/router';
import { PuzzlePlayer } from '../components/PuzzlePlayer';
import { LineChart } from '../components/LineChart';

/** Shown until the puzzle database exists. */
export function PuzzleSetup({ status, onStarted }: { status: PuzzleStatus; onStarted: () => void }) {
  const b = status.build;
  return (
    <div className="db-setup">
      <h2>Set up the puzzle trainer</h2>
      <p>
        This downloads the Lichess puzzle database (public domain, about 300 MB) and keeps around 280,000 well-tested puzzles, every one
        from a real game, rated from beginner to master and tagged by theme.
      </p>
      {b.running ? (
        <div className="build-progress">
          <div className="row-between">
            <b>{b.step || 'Starting…'}</b>
            <span className="muted small">{Math.round(b.progress * 100)}%</span>
          </div>
          <div className="progress big"><div style={{ width: `${b.progress * 100}%`, transform: 'none' }} /></div>
        </div>
      ) : (
        <>
          {b.state === 'error' && <div className="error">The last attempt failed: {b.error}</div>}
          <button className="btn-green" onClick={() => buildPuzzles().then(onStarted)}>Set up puzzles</button>
        </>
      )}
    </div>
  );
}

export function usePuzzleStatus() {
  const [status, setStatus] = useState<PuzzleStatus | null>(null);
  const refresh = useCallback(() => puzzleStatus().then(setStatus, () => setStatus(null)), []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (!status?.build.running) return;
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, [status?.build.running, refresh]);
  return { status, refresh };
}

const CORE = THEMES.slice(0, 12);

type ThemeChip = { key: string; label: string; tip: string; lesson?: string };

/**
 * Rated training: puzzles near your rating, optionally one theme. `chips` + `base` give a section its own
 * theme row (e.g. Endgames → train/endgames/<theme>); by default the general tactics themes.
 */
export function RatedTraining({ theme, chips, base = 'train/theme', footer }: { theme?: string; chips?: ThemeChip[]; base?: string; footer?: ReactNode }) {
  const [rating, setRating] = useState(() => getRating().rating);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [result, setResult] = useState<{ solved: boolean; delta: number } | null>(null);
  const [session, setSession] = useState({ solved: 0, total: 0, streak: 0 });
  const [error, setError] = useState('');
  const [autoNext, setAutoNext] = useState(() => load(KEYS.puzzleRating + '-auto', true));

  const next = useCallback(() => {
    setResult(null);
    setError('');
    fetchPuzzle(getRating().rating, theme).then(setPuzzle, (e) => setError((e as Error).message));
  }, [theme]);
  useEffect(() => {
    next();
  }, [next]);

  const onDone = useCallback(
    ({ solved }: { solved: boolean }) => {
      if (!puzzle) return;
      markSeen(puzzle.id);
      const { before, after } = updateRating(puzzle.rating, solved, puzzle.themes);
      scheduleReview(puzzle.id, solved, false);
      logActivity('puzzle');
      if (solved) logActivity('puzzleSolved');
      if (solved && theme) countThemeSolve(theme);
      setRating(after);
      setResult({ solved, delta: after - before });
      setSession((s) => ({ solved: s.solved + (solved ? 1 : 0), total: s.total + 1, streak: solved ? s.streak + 1 : 0 }));
      if (solved && autoNext) window.setTimeout(next, 1100);
    },
    [puzzle, autoNext, next, theme],
  );

  return (
    <div>
      {chips ? (
        <div className="chips theme-chips">
          {chips.map((t) => (
            <button key={t.key} className={`chip ${theme === t.key ? 'on' : ''}`} title={t.tip} onClick={() => navigate(`${base}/${t.key}`)}>
              {t.label}
            </button>
          ))}
        </div>
      ) : (
      <div className="chips theme-chips">
        <button className={`chip ${!theme ? 'on' : ''}`} onClick={() => navigate('train')}>All themes</button>
        {CORE.map((t) => (
          <button key={t.key} className={`chip ${theme === t.key ? 'on' : ''}`} title={t.tip} onClick={() => navigate(`train/theme/${t.key}`)}>
            {t.label}
          </button>
        ))}
        <select
          className="chip-select"
          value={THEMES.slice(12).some((t) => t.key === theme) ? theme : ''}
          onChange={(e) => e.target.value && navigate(`train/theme/${e.target.value}`)}
          aria-label="More themes"
        >
          <option value="">More…</option>
          {THEMES.slice(12).map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>
      )}
      {theme && (
        <p className="muted small theme-tip">
          <b>{themeLabel(theme)}</b>: {themeInfo(theme)?.tip}
          {themeInfo(theme)?.lesson && <> <a href={`#/learn/${themeInfo(theme)!.lesson}`}>Read the lesson →</a></>}
        </p>
      )}
      {error && <div className="error">{error}</div>}
      {puzzle && (
        <PuzzlePlayer key={puzzle.id} puzzle={puzzle} onDone={onDone}>
          <div className="rating-panel">
            <div className="muted small">Puzzle rating</div>
            <div className="big-rating">
              {rating}
              {result && <span className={`delta ${result.delta >= 0 ? 'up' : 'down'}`}>{result.delta >= 0 ? `+${result.delta}` : result.delta}</span>}
            </div>
            <div className="muted small">
              This session: {session.solved}/{session.total} solved{session.streak >= 3 ? ` · 🔥 ${session.streak} in a row` : ''}
            </div>
          </div>
          {result && (
            <button className="btn-green wide" onClick={next}>Next puzzle →</button>
          )}
          <label className="check-row small">
            <input
              type="checkbox"
              checked={autoNext}
              onChange={(e) => {
                setAutoNext(e.target.checked);
                save(KEYS.puzzleRating + '-auto', e.target.checked);
              }}
            />
            Jump to the next puzzle after a correct solve
          </label>
          {result && (
            <a className="small" href={`#/explore?fen=${encodeURIComponent(puzzle.fen)}`}>Analyse this position →</a>
          )}
        </PuzzlePlayer>
      )}
      {footer}
      <RatingProgress key={session.total} />
    </div>
  );
}

/** Puzzle rating after each attempt, once there is enough history to show a trend. */
function RatingProgress() {
  const history = getRating().history;
  if (history.length < 5) return null;
  return (
    <div className="chapter">
      <LineChart title="Your puzzle rating" data={history.map((h, i) => ({ x: i + 1, y: h.r }))} xFormat={(x) => `Puzzle ${x}`} />
    </div>
  );
}

const RUSH_MODES = [
  { id: '3', label: '3 minutes', seconds: 180, blurb: 'Solve as many as you can in 3 minutes.' },
  { id: '5', label: '5 minutes', seconds: 300, blurb: 'Five minutes: a little more time to calculate the harder ones.' },
  { id: 'survival', label: 'Survival', seconds: Infinity, blurb: 'No clock: keep going until your third mistake. Accuracy over speed.' },
] as const;
type RushMode = (typeof RUSH_MODES)[number]['id'];
const RUSH_BESTS = 'cca-rush-bests'; // 5-minute and survival bests (the 3-minute best is KEYS.rushBest)

/** Puzzle Rush: 3 strikes, puzzles get harder as you go, against the clock or in survival mode. Trains fast pattern recognition. */
export function PuzzleRush() {
  const [mode, setMode] = useState<RushMode>(() => load<RushMode>('cca-rush-mode', '3'));
  const RUSH_SECONDS = RUSH_MODES.find((m) => m.id === mode)!.seconds;
  const [phase, setPhase] = useState<'ready' | 'running' | 'over'>('ready');
  const [left, setLeft] = useState<number>(RUSH_SECONDS);
  const [score, setScore] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [index, setIndex] = useState(0);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const readBest = (m: RushMode) => (m === '3' ? load(KEYS.rushBest, 0) : (load<Record<string, number>>(RUSH_BESTS, {})[m] ?? 0));
  const [best, setBest] = useState(() => readBest(mode));
  const startedAt = useRef(0);

  const loadPuzzle = useCallback((i: number) => fetchPuzzle(550 + i * 45).then(setPuzzle), []);

  useEffect(() => {
    if (phase !== 'running' || !Number.isFinite(RUSH_SECONDS)) return;
    const t = setInterval(() => {
      const remaining = Math.max(0, RUSH_SECONDS - (Date.now() - startedAt.current) / 1000);
      setLeft(remaining);
      if (remaining <= 0) setPhase('over');
    }, 200);
    return () => clearInterval(t);
  }, [phase, RUSH_SECONDS]);

  useEffect(() => {
    if (phase !== 'over') return;
    if (score > best) {
      if (mode === '3') save(KEYS.rushBest, score);
      else save(RUSH_BESTS, { ...load<Record<string, number>>(RUSH_BESTS, {}), [mode]: score });
      setBest(score);
    }
  }, [phase, score, best, mode]);

  function start() {
    setScore(0);
    setStrikes(0);
    setIndex(0);
    setLeft(RUSH_SECONDS);
    setPuzzle(null);
    loadPuzzle(0).then(() => {
      startedAt.current = Date.now();
      setPhase('running');
    });
  }

  function onDone({ solved }: { solved: boolean }) {
    if (!puzzle || phase !== 'running') return;
    markSeen(puzzle.id);
    logActivity('puzzle');
    if (solved) {
      logActivity('puzzleSolved');
      setScore((s) => s + 1);
    } else {
      scheduleReview(puzzle.id, false, false);
      if (strikes + 1 >= 3) {
        setStrikes(3);
        setPhase('over');
        return;
      }
      setStrikes((s) => s + 1);
    }
    const i = index + 1;
    setIndex(i);
    window.setTimeout(() => loadPuzzle(i), solved ? 250 : 900);
  }

  if (phase === 'ready' || phase === 'over')
    return (
      <div className="rush-start panel">
        {phase === 'over' ? (
          <>
            <div className="muted">{strikes >= 3 ? 'Three strikes!' : 'Time’s up!'}</div>
            <div className="rush-score">{score}</div>
            <div>{score > 0 && score >= best ? '🏆 New personal best!' : `Personal best: ${best}`}</div>
          </>
        ) : (
          <>
            <h2>Puzzle Rush</h2>
            <p className="muted">{RUSH_MODES.find((m) => m.id === mode)!.blurb} Puzzles start easy and get harder. Three mistakes and you’re out.</p>
            {best > 0 && <div>Personal best: <b>{best}</b></div>}
          </>
        )}
        <div className="seg">
          {RUSH_MODES.map((m) => (
            <button key={m.id} className={mode === m.id ? 'on' : ''} onClick={() => { setMode(m.id); save('cca-rush-mode', m.id); setLeft(m.seconds); setBest(readBest(m.id)); }}>{m.label}</button>
          ))}
        </div>
        <button className="btn-green big" onClick={start}>{phase === 'over' ? 'Play again' : 'Start'}</button>
      </div>
    );

  return (
    <div>
      <div className="rush-bar">
        <span className={`rush-time ${left < 20 ? 'low' : ''}`}>{Number.isFinite(left) ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : '∞'}</span>
        <span className="rush-points">✓ {score}</span>
        <span className="rush-strikes">{[0, 1, 2].map((i) => <span key={i} className={i < strikes ? 'x on' : 'x'}>✕</span>)}</span>
      </div>
      {puzzle && <PuzzlePlayer key={puzzle.id} puzzle={puzzle} onDone={onDone} showRating={false} failFast />}
    </div>
  );
}

