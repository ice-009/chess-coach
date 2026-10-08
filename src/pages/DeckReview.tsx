import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Board } from '../components/Board';
import { FindBetterMove } from '../components/FindBetterMove';
import { MovePuzzle } from '../components/MovePuzzle';
import { PuzzlePlayer } from '../components/PuzzlePlayer';
import { ENCYCLOPEDIA } from '../data/encyclopedia';
import { OPENINGS } from '../data/openings';
import { findLesson } from '../data/lessons';
import { logActivity } from '../lib/activity';
import { AGAIN, EASY, GOOD, HARD, KIND_LABEL, deckStats, dueCards, gradeCard, gradeFrom } from '../lib/deck';
import type { Card, CardKind, Grade } from '../lib/deck';
import { quizLines } from '../lib/openingQuiz';
import type { Color } from '../lib/openingQuiz';
import { fetchPuzzleById } from '../lib/puzzles';
import type { Puzzle } from '../lib/puzzles';
import { afterMove, sanOf } from '../lib/safety';
import { playSound } from '../lib/sound';
import { sectionFen } from '../lib/chess';
import { QuizRound } from './OpeningQuiz';

const GRADE_LABEL: Record<Grade, string> = { [AGAIN]: 'It comes back in a few minutes and tomorrow', [HARD]: 'It comes back soon', [GOOD]: 'It comes back in a while', [EASY]: 'It comes back much later' } as Record<Grade, string>;
const ALL_LINES = quizLines([...OPENINGS, ...ENCYCLOPEDIA]);

/** One card, in whatever form its kind needs. Calls `onResult` once with how it went. */
function CardView({ card, onResult }: { card: Card; onResult: (g: Grade) => void }) {
  const started = useRef(Date.now());
  const seconds = () => (Date.now() - started.current) / 1000;

  if (card.kind === 'puzzle') return <PuzzleCard card={card} onResult={(solved) => onResult(gradeFrom({ correct: solved, seconds: solved ? seconds() / 2 : undefined }))} />;
  if (card.kind === 'mistake' && card.data?.fen && card.data.best)
    return <FindBetterMove id={`deck-${card.id}`} fen={card.data.fen} best={card.data.best} played={card.data.uci} explain={card.data.explain} source={card.data.source} onDone={(r) => onResult(gradeFrom(r))} />;
  if (card.kind === 'safety' && card.data?.fen && card.data.uci) return <SafetyCard card={card} onResult={(right) => onResult(gradeFrom({ correct: right, seconds: seconds() }))} />;
  if (card.kind === 'opening') return <OpeningCard card={card} onResult={onResult} />;
  if (card.kind === 'lesson') return <LessonCard card={card} onResult={(first, revealed) => onResult(revealed ? AGAIN : first ? GOOD : HARD)} />;
  return <div className="error">This card can’t be shown any more.</div>;
}

function PuzzleCard({ card, onResult }: { card: Card; onResult: (solved: boolean) => void }) {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetchPuzzleById(card.ref).then(setPuzzle, () => setError('This puzzle couldn’t be loaded (are you offline without the puzzles saved?).'));
  }, [card.ref]);
  if (error) return <div className="error">{error}</div>;
  if (!puzzle) return <div className="page-loading"><span className="spinner" /></div>;
  return <PuzzlePlayer key={puzzle.id} puzzle={puzzle} showRating={false} onDone={({ solved }) => onResult(solved)} />;
}

function SafetyCard({ card, onResult }: { card: Card; onResult: (right: boolean) => void }) {
  const d = card.data!;
  const [answer, setAnswer] = useState<'safe' | 'unsafe' | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const decide = (a: 'safe' | 'unsafe') => {
    if (answer) return;
    setAnswer(a);
    const right = a === d.verdict;
    playSound(right ? 'correct' : 'wrong');
    onResult(right);
    const after = afterMove(d.fen!, d.uci!);
    window.setTimeout(() => setShown(after), 450);
    if (d.verdict === 'unsafe' && d.reply) window.setTimeout(() => setShown(afterMove(after, d.reply!)), 1350);
  };
  const arrows = useMemo(() => (shown ? [] : [[d.uci!, 'rgba(255,170,0,0.85)'] as [string, string]]), [shown, d.uci]);
  return (
    <div className="find-move">
      <div className="find-board">
        <Board id={`deck-${card.id}`} fen={shown ?? d.fen!} orientation={d.fen!.split(' ')[1] === 'b' ? 'black' : 'white'} arrows={arrows} maxWidth={560} />
      </div>
      <div className="find-side">
        {!answer ? (
          <>
            <div className="safety-ask">You’re about to play <b className="safety-move">{sanOf(d.fen!, d.uci!)}</b>. Is it safe?</div>
            <div className="safety-buttons">
              <button className="btn-green" onClick={() => decide('safe')}>✓ Safe</button>
              <button className="btn-danger" onClick={() => decide('unsafe')}>✗ Not safe</button>
            </div>
          </>
        ) : (
          <>
            <div className={`quick-result ${answer === d.verdict ? 'good' : 'bad'}`}><b>{answer === d.verdict ? '✓ Right!' : '✗ Not quite.'} It’s {d.verdict === 'safe' ? 'safe' : 'not safe'}.</b></div>
            {d.explain && <p className="quick-explain">{d.explain}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function OpeningCard({ card, onResult }: { card: Card; onResult: (g: Grade) => void }) {
  const [lineId, color] = card.ref.split('|') as [string, Color];
  const line = ALL_LINES.find((l) => l.id === lineId);
  const lines = useMemo(() => (line ? ALL_LINES.filter((l) => l.opening.id === line.opening.id) : []), [line]);
  if (!line) return <div className="error">This opening line no longer exists.</div>;
  return (
    <div>
      <p className="muted small">Play {line.opening.name}: {line.name} from memory as {color === 'w' ? 'White' : 'Black'}.</p>
      <QuizRound line={line} color={color} lines={lines} onDone={(r) => onResult(r.misses.length === 0 ? GOOD : r.misses.length === 1 ? HARD : AGAIN)} />
    </div>
  );
}

function LessonCard({ card, onResult }: { card: Card; onResult: (firstTry: boolean, revealed?: boolean) => void }) {
  const [lessonId, idx] = card.ref.split('#');
  const found = findLesson(lessonId);
  const s = found?.lesson.sections[Number(idx)];
  if (!found || !s || s.kind !== 'exercise') return <div className="error">This exercise no longer exists.</div>;
  return (
    <div className="exercise">
      <div className="exercise-tag">From the lesson “{found.lesson.title}”</div>
      <MovePuzzle id={`deck-${card.id}`} fen={sectionFen(s)} solutions={s.solutions} prompt={s.prompt} explain={s.explain} onDone={onResult} />
    </div>
  );
}

/**
 * Daily review: everything that's due, mixed together. A card you miss comes back a few cards later in the same
 * session (and tomorrow); everything else is rescheduled by FSRS.
 */
export function DeckReview() {
  const [queue, setQueue] = useState<Card[]>(() => dueCards());
  const [index, setIndex] = useState(0);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [results, setResults] = useState<{ card: Card; grade: Grade }[]>([]);
  const requeued = useRef(new Set<string>());
  const stats = useMemo(() => deckStats(), [index, grade]); // eslint-disable-line react-hooks/exhaustive-deps
  const card = queue[index];

  const onResult = useCallback(
    (g: Grade) => {
      if (!card || grade !== null) return;
      gradeCard(card.id, g);
      logActivity('review');
      setGrade(g);
      setResults((r) => [...r, { card, grade: g }]);
      // missed: once more in this session, a few cards later
      if (g === AGAIN && !requeued.current.has(card.id)) {
        requeued.current.add(card.id);
        setQueue((q) => [...q.slice(0, index + 4), card, ...q.slice(index + 4)]);
      }
    },
    [card, grade, index],
  );
  const next = useCallback(() => {
    setGrade(null);
    setIndex((i) => i + 1);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (grade !== null && (e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [grade, next]);

  const kinds = (Object.keys(KIND_LABEL) as CardKind[]).filter((k) => queue.slice(index).some((c) => c.kind === k));

  if (!card) {
    const right = results.filter((r) => r.grade !== AGAIN).length;
    return (
      <div className="deck-done panel" data-reviewed={results.length}>
        <h2>{results.length ? '✓ Review done' : 'Nothing to review right now'}</h2>
        {results.length > 0 && <p>You reviewed {results.length} card{results.length > 1 ? 's' : ''} and got {right} right.</p>}
        <p className="muted">
          {stats.total
            ? `${stats.total} card${stats.total > 1 ? 's' : ''} in your deck.${stats.nextDue ? ` The next one is due ${new Date(stats.nextDue).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}.` : ''}`
            : 'Your deck is empty for now.'}
          {stats.retention !== null && ` You’d remember about ${stats.retention}% of it right now.`}
        </p>
        <div className="deck-how">
          <b>How cards get here</b>
          <ul className="quick-rules">
            <li>Puzzles you miss, “Is it safe?” positions you get wrong and the key moments from your Quick Reviews</li>
            <li>Opening lines you quiz and the exercises in the lessons you finish</li>
          </ul>
          <p className="muted small">Each comes back just before you’d forget it, scheduled by FSRS (the algorithm Anki uses), and they’re mixed together on purpose: mixing makes you recognise which idea a position needs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="deck-review" data-card={card.kind}>
      <div className="deck-head">
        <div className="deck-progress">
          <b>{index + 1}</b><span className="muted"> of {queue.length}</span>
          <div className="progress thin"><div style={{ transform: `scaleX(${index / queue.length})` }} /></div>
        </div>
        <span className={`deck-kind k-${card.kind}`}>{KIND_LABEL[card.kind]}</span>
        <span className="muted small deck-mix">{kinds.length > 1 ? `Mixed: ${kinds.map((k) => KIND_LABEL[k].toLowerCase()).join(', ')}` : ''}</span>
      </div>
      <CardView key={`${card.id}-${index}`} card={card} onResult={onResult} />
      {grade !== null && (
        <div className={`deck-result ${grade === AGAIN ? 'bad' : 'good'}`}>
          <span>{grade === AGAIN ? '✗ Missed.' : grade === HARD ? '✓ Got it, with a slip.' : '✓ Got it.'} <span className="muted">{GRADE_LABEL[grade]}.</span></span>
          <button className="btn-green" onClick={next}>Next →</button>
        </div>
      )}
    </div>
  );
}
