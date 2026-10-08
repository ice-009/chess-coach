import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import type { Puzzle } from '../lib/analysis';
import { CHAPTERS } from '../data/lessons';
import { navigate } from '../lib/router';
import { KEYS, getMe, load, save } from '../lib/storage';
import { MovePuzzle } from '../components/MovePuzzle';
import { CLASS_META } from '../lib/classMeta';
import { sectionFen } from './LearnPage';
import { PuzzleRush, PuzzleSetup, RatedTraining, usePuzzleStatus } from './PuzzleModes';
import { SafetyDrill } from './SafetyDrill';
import { AGAIN, GOOD, addCard, dueCount } from '../lib/deck';
import { DeckReview } from './DeckReview';
import { ENDGAME_THEMES, MATE_THEMES } from '../lib/puzzles';

type Solved = Record<string, boolean>; // puzzle id → solved on first try

function MyMistakes() {
  const [puzzles] = useState<Puzzle[]>(() => load(KEYS.puzzles, []));
  const [solved, setSolved] = useState<Solved>(() => load(KEYS.puzzlesSolved, {}));
  const [current, setCurrent] = useState<string | null>(null);
  const me = getMe();

  const queue = useMemo(() => [...puzzles.filter((p) => !solved[p.id]), ...puzzles.filter((p) => solved[p.id])], [puzzles, solved]);
  const puzzle = puzzles.find((p) => p.id === current) ?? queue[0];
  const cleanCount = Object.values(solved).filter(Boolean).length;

  if (!puzzles.length) {
    return (
      <div className="empty">
        <p>No puzzles yet. They’re made from <b>your own mistakes</b>.</p>
        <p className="muted">
          {me ? (
            <>Open some of your games in <a href={`#/games/${me}`}>Games</a> and let Stockfish analyse them. Every mistake or blunder you made becomes a puzzle here.</>
          ) : (
            <>Go to <a href="#/games">Games</a>, enter your chess.com username, and analyse a few of your games. Every mistake or blunder becomes a puzzle here.</>
          )}
        </p>
      </div>
    );
  }

  function done(firstTry: boolean) {
    if (!puzzle) return;
    try {
      const played = new Chess(puzzle.fen).move(puzzle.playedSan);
      addCard({ kind: 'mistake', ref: puzzle.id, title: `Your game, move ${puzzle.moveNo}`, data: { fen: puzzle.fen, uci: played.from + played.to + (played.promotion ?? ''), best: puzzle.best, source: `From your game, move ${puzzle.moveNo}` } }, firstTry ? GOOD : AGAIN);
    } catch {
      // a position that no longer parses: skip the deck
    }
    const next = { ...solved, [puzzle.id]: firstTry || !!solved[puzzle.id] };
    save(KEYS.puzzlesSolved, next);
    setSolved(next);
  }

  function nextPuzzle() {
    const i = queue.findIndex((p) => p.id === puzzle?.id);
    setCurrent(queue[(i + 1) % queue.length].id);
  }

  return (
    <div>
      <div className="stats-row">
        <div className="stat"><b>{puzzles.length}</b><span>from your games</span></div>
        <div className="stat"><b>{cleanCount}</b><span>solved first try</span></div>
        <div className="stat"><b>{puzzles.length - cleanCount}</b><span>to master</span></div>
      </div>
      {puzzle && (
        <>
          <p>
            In this position you played <b style={{ color: CLASS_META[puzzle.classification].color }}>{puzzle.playedSan}</b> (a {CLASS_META[puzzle.classification].label.toLowerCase()}, move {puzzle.moveNo}). Find the better move.
          </p>
          <MovePuzzle
            key={puzzle.id}
            id="mistake-puzzle"
            fen={puzzle.fen}
            solutions={[puzzle.best]}
            explain={`The engine’s move was **${puzzle.bestSan}**. Ask yourself what you missed: a check, a capture, or a threat?`}
            onDone={done}
          />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="primary" onClick={nextPuzzle}>Next puzzle →</button>
            <a href={puzzle.gameUrl} target="_blank" rel="noreferrer" className="muted small">Open the game on chess.com ↗</a>
          </div>
        </>
      )}
    </div>
  );
}

interface Daily {
  title: string;
  fen: string;
  first: string;
  solution: string;
  url: string;
}

function DailyPuzzle() {
  const [daily, setDaily] = useState<Daily | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('https://api.chess.com/pub/puzzle')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`chess.com API error (${r.status})`))))
      .then((d) => {
        const c = new Chess();
        c.loadPgn(d.pgn.replace(/\r/g, ''));
        const moves = c.history();
        if (!moves.length) throw new Error('The daily puzzle has no solution moves.');
        setDaily({ title: d.title, fen: d.fen, first: moves[0], solution: moves.join(' '), url: d.url });
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!daily) return <div className="muted">Loading today’s puzzle…</div>;
  return (
    <div>
      <h3>{daily.title}</h3>
      <MovePuzzle id="daily-puzzle" fen={daily.fen} solutions={[daily.first]} explain={`Full solution: **${daily.solution}**`} />
      <a href={daily.url} target="_blank" rel="noreferrer" className="muted small">View on chess.com ↗</a>
    </div>
  );
}

function LessonExercises() {
  const exercises = useMemo(
    () =>
      CHAPTERS.flatMap((c) =>
        c.lessons.flatMap((l) =>
          l.sections.flatMap((s, i) => (s.kind === 'exercise' ? [{ id: `${l.id}-${i}`, lesson: l, fen: sectionFen(s), s }] : [])),
        ),
      ),
    [],
  );
  const [i, setI] = useState(0);
  const ex = exercises[i];
  return (
    <div>
      <div className="muted small">
        Exercise {i + 1} of {exercises.length} · from <a href={`#/learn/${ex.lesson.id}`}>{ex.lesson.title}</a>
      </div>
      <MovePuzzle key={ex.id} id="lesson-ex" fen={ex.fen} solutions={ex.s.solutions} prompt={ex.s.prompt} explain={ex.s.explain} />
      <div className="row" style={{ marginTop: 10 }}>
        <button onClick={() => setI((i - 1 + exercises.length) % exercises.length)}>← Previous</button>
        <button className="primary" onClick={() => setI((i + 1) % exercises.length)}>Next →</button>
      </div>
    </div>
  );
}

const TABS = [
  { id: '', label: 'Rated puzzles' },
  { id: 'safe', label: 'Is it safe?' },
  { id: 'endgames', label: 'Endgames' },
  { id: 'mates', label: 'Checkmates' },
  { id: 'rush', label: 'Puzzle Rush' },
  { id: 'review', label: 'Daily review' },
  { id: 'mistakes', label: 'My mistakes' },
  { id: 'daily', label: 'Daily' },
  { id: 'lessons', label: 'Lesson exercises' },
];

export function TrainPage({ tab = '', arg }: { tab?: string; arg?: string }) {
  const { status, refresh } = usePuzzleStatus();
  const due = dueCount();
  const needsDb = ['', 'theme', 'endgames', 'mates', 'rush', 'review', 'safe'].includes(tab);
  const active = tab === 'theme' ? '' : tab;
  return (
    <div>
      <div className="page-head hide-intro-sm">
        <h1>Puzzles</h1>
        <p className="muted">Tactics decide most games below 2000. A little every day beats a lot once a week.</p>
      </div>
      <div className="seg scroll-sm">
        {TABS.map((t) => (
          <button key={t.id} className={active === t.id ? 'on' : ''} onClick={() => navigate(`train${t.id ? `/${t.id}` : ''}`)}>
            {t.label}
            {t.id === 'review' && due > 0 && <span className="count-badge">{due}</span>}
          </button>
        ))}
      </div>
      {needsDb && status && !status.ready ? (
        <PuzzleSetup status={status} onStarted={refresh} />
      ) : needsDb && !status ? (
        <div className="page-loading"><span className="spinner" /></div>
      ) : tab === '' || tab === 'theme' ? (
        <RatedTraining key={arg ?? 'all'} theme={tab === 'theme' ? arg : undefined} />
      ) : tab === 'endgames' ? (
        <RatedTraining
          key={`e-${arg ?? 'endgame'}`}
          theme={arg ?? 'endgame'}
          chips={ENDGAME_THEMES}
          base="train/endgames"
          footer={<p className="muted small">Want the theory first? Try the <a href="#/practice/drills">endgame drills</a> against the computer and the <a href="#/learn/kp-endgames">endgame lessons</a>.</p>}
        />
      ) : tab === 'mates' ? (
        <RatedTraining
          key={`m-${arg ?? 'mate'}`}
          theme={arg ?? 'mate'}
          chips={MATE_THEMES}
          base="train/mates"
          footer={<p className="muted small">The basic mates with a lone king (queen, rook, two bishops, bishop and knight) are in <a href="#/practice/drills">Practice → Endgame drills</a>.</p>}
        />
      ) : tab === 'safe' ? (
        <SafetyDrill />
      ) : tab === 'rush' ? (
        <PuzzleRush />
      ) : tab === 'review' ? (
        <DeckReview />
      ) : tab === 'daily' ? (
        <DailyPuzzle />
      ) : tab === 'lessons' ? (
        <LessonExercises />
      ) : (
        <MyMistakes />
      )}
    </div>
  );
}
