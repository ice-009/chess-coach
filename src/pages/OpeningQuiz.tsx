import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { Board } from '../components/Board';
import type { Promotion } from '../components/Board';
import { logActivity } from '../lib/activity';
import { consistent, defaultMode, loadResults, ownColor, quizLines, quizScope, saveResult, sessionOrder } from '../lib/openingQuiz';
import type { Color, QuizLine, QuizMode } from '../lib/openingQuiz';
import { navigate } from '../lib/router';
import { playSound } from '../lib/sound';
import { AGAIN, GOOD, HARD, addCard } from '../lib/deck';
import { useFitTop } from '../lib/useFitTop';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const sideName = (c: Color) => (c === 'w' ? 'White' : 'Black');
const label = (ply: number, san: string) => `${Math.floor(ply / 2) + 1}${ply % 2 ? '…' : '.'} ${san}`;

interface Miss {
  label: string; // "7. Nb3"
  comment?: string;
}

export interface RoundResult {
  line: QuizLine;
  color: Color;
  misses: Miss[];
}

/** One line: the computer plays its side's book moves, you play yours from memory. */
export function QuizRound({ line, color, lines, onDone }: { line: QuizLine; color: Color; lines: QuizLine[]; onDone: (r: RoundResult) => void }) {
  const fitRef = useFitTop<HTMLDivElement>();
  const [target, setTarget] = useState(line); // may switch when you choose another book move at a branch
  const [played, setPlayed] = useState<string[]>([]); // UCI
  const [wrong, setWrong] = useState(0); // wrong tries on the current move
  const [misses, setMisses] = useState<Miss[]>([]);
  const [feedback, setFeedback] = useState('');
  const ply = played.length;
  const done = ply >= target.moves.length;
  const fen = ply ? target.moves[ply - 1].fenAfter : (target.moves[0]?.fenBefore ?? START);
  const myTurn = !done && fen.split(' ')[1] === color;

  // the computer's moves come from the line it chose for this round
  useEffect(() => {
    if (done || myTurn) return;
    const t = setTimeout(() => setPlayed((p) => [...p, target.moves[p.length].uci]), 550);
    return () => clearTimeout(t);
  }, [done, myTurn, target, ply]);

  const reported = useRef(false);
  useEffect(() => {
    if (!done || reported.current) return;
    reported.current = true;
    onDone({ line: target, color, misses });
  }, [done, target, color, misses, onDone]);

  const onMove = useCallback(
    (from: Square, to: Square, promotion: Promotion = 'q'): boolean => {
      if (!myTurn) return false;
      let m;
      try {
        m = new Chess(fen).move({ from, to, promotion });
      } catch {
        return false;
      }
      const uci = m.from + m.to + (m.promotion ?? '');
      // any book move from the lines in this quiz counts, not only the computer's chosen line
      const options = consistent(lines, played).filter((l) => l.moves[ply].uci === uci);
      if (options.length) {
        const next = options.includes(target) ? target : options[Math.floor(Math.random() * options.length)];
        if (next !== target) setTarget(next);
        const node = next.moves[ply];
        setFeedback(node.comment ? `✓ ${node.san}: ${node.comment}` : `✓ ${node.san}`);
        setWrong(0);
        setPlayed([...played, uci]);
        return true;
      }
      const expected = target.moves[ply];
      playSound('wrong');
      if (wrong === 0) setMisses((ms) => [...ms, { label: label(ply, expected.san), comment: expected.comment }]);
      setWrong(wrong + 1);
      setFeedback(wrong === 0 ? 'Not the book move here. Think about the plan of this opening and try again.' : `The book move is ${expected.san}. Play it to continue.`);
      return false;
    },
    [myTurn, fen, lines, played, ply, target, wrong],
  );

  const last = ply ? target.moves[ply - 1] : null;
  const squares = useMemo<Record<string, string>>(() => (last ? { [last.from]: 'rgba(250,204,21,0.4)', [last.to]: 'rgba(250,204,21,0.4)' } : {}), [last]);
  const arrows = useMemo(() => (myTurn && wrong >= 2 ? [target.moves[ply].uci] : []), [myTurn, wrong, target, ply]);

  return (
    <div className="puzzle-play quiz-round" ref={fitRef} data-line={target.id /* for tests: the line the computer is playing */}>
      <div className="puzzle-board">
        <Board id="quiz-board" fen={fen} orientation={color === 'w' ? 'white' : 'black'} onMove={done ? undefined : onMove} squares={squares} arrows={arrows} maxWidth={600} />
      </div>
      <div className="puzzle-side panel">
        <div className="puzzle-status">
          <span className={`turn-dot ${color}`} />
          <div>
            <b>{done ? 'Line complete' : myTurn ? 'Your move' : 'The computer is playing a book move…'}</b>
            <div className="muted small">You play {sideName(color)}. Which line is it? You’ll see at the end.</div>
          </div>
        </div>
        <div className="progress"><div style={{ width: `${(ply / target.moves.length) * 100}%`, transform: 'none' }} /></div>
        {feedback && <div className={`note ${feedback.startsWith('✓') ? '' : 'quiz-wrong'}`}>{feedback}</div>}
        {misses.length > 0 && <div className="muted small">Mistakes so far: {misses.length}</div>}
      </div>
    </div>
  );
}

function Setup({ scope, title, lines, onStart }: { scope: string; title: string; lines: QuizLine[]; onStart: (c: QuizMode) => void }) {
  const results = loadResults();
  const passed = (c: Color) => lines.filter((l) => results[l.id]?.[c]?.passed).length;
  const suggested = defaultMode([...new Set(lines.map((l) => l.opening))]);
  const bothSides = new Set(lines.map((l) => l.opening.side)).size > 1;
  return (
    <div className="quiz-setup panel">
      <h2>🧪 Quiz: {title}</h2>
      <p className="muted">
        {lines.length} line{lines.length > 1 ? 's' : ''} from {new Set(lines.map((l) => l.opening.id)).size} opening{new Set(lines.map((l) => l.opening.id)).size > 1 ? 's' : ''}. The
        computer picks a different line each round and plays its side’s book moves; you play yours from memory. A wrong move is a mistake: try again,
        and after two tries the right move is shown. A line is passed when you play it without a mistake.
      </p>
      <div className="quiz-progress">
        <div><b>{passed('w')}/{lines.length}</b><span>passed as White</span></div>
        <div><b>{passed('b')}/{lines.length}</b><span>passed as Black</span></div>
      </div>
      <div className="row">
        {bothSides && <button className={suggested === 'own' ? 'btn-green' : 'btn-secondary'} onClick={() => onStart('own')}>My side of each line</button>}
        <button className={suggested === 'w' ? 'btn-green' : 'btn-secondary'} onClick={() => onStart('w')}>Play as White</button>
        <button className={suggested === 'b' ? 'btn-green' : 'btn-secondary'} onClick={() => onStart('b')}>Play as Black</button>
        <button className={suggested === 'mixed' ? 'btn-green' : 'btn-secondary'} onClick={() => onStart('mixed')}>Both colours</button>
      </div>
      {scope !== 'repertoire' && scope !== 'encyclopedia' && <p className="muted small">Haven’t studied these lines yet? Go back and use Study first.</p>}
    </div>
  );
}

/** A quiz session over every line in scope: as White, as Black, or both (alternating). */
export function OpeningQuiz({ scope, color: colorParam }: { scope: string; color?: string }) {
  const { title, openings } = useMemo(() => quizScope(scope), [scope]);
  const lines = useMemo(() => quizLines(openings), [openings]);
  const [mode, setMode] = useState<QuizMode | null>(['w', 'b', 'mixed', 'own'].includes(colorParam ?? '') ? (colorParam as QuizMode) : null);
  const [queue, setQueue] = useState<{ line: QuizLine; color: Color }[]>([]);
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);

  const start = useCallback(
    (m: QuizMode, only?: QuizLine[]) => {
      const pool = only ?? lines;
      // both colours: every line once as White and once as Black, alternating
      const asBlack = sessionOrder(pool, 'b');
      const q =
        m === 'mixed'
          ? sessionOrder(pool, 'w').flatMap((l, i) => [{ line: l, color: 'w' as Color }, { line: asBlack[i], color: 'b' as Color }])
          : sessionOrder(pool, m).map((l) => ({ line: l, color: m === 'own' ? ownColor(l) : m }));
      setMode(m);
      setQueue(q);
      setRound(0);
      setResults([]);
    },
    [lines],
  );
  useEffect(() => {
    if (mode && !queue.length) start(mode);
  }, [mode, queue.length, start]);

  const onDone = useCallback((r: RoundResult) => {
    saveResult(r.line.id, r.color, r.misses.length);
    // every quizzed line joins your review deck, so your openings stay fresh
    addCard({ kind: 'opening', ref: `${r.line.id}|${r.color}`, title: `${r.line.opening.name}: ${r.line.name}` }, r.misses.length === 0 ? GOOD : r.misses.length === 1 ? HARD : AGAIN);
    logActivity('opening');
    setResults((rs) => [...rs, r]);
  }, []);

  const back = (
    <button onClick={() => navigate(openings.length === 1 ? `openings/${openings[0].id}` : scope.startsWith('enc') ? 'openings?view=encyclopedia' : 'openings')}>
      ← {openings.length === 1 ? openings[0].name : 'Openings'}
    </button>
  );
  if (!lines.length) return <div>{back}<div className="error">Nothing to quiz here.</div></div>;
  if (!mode || !queue.length) return <div>{back}<Setup scope={scope} title={title} lines={lines} onStart={start} /></div>;

  const finished = round >= queue.length; // after the last line's result card, “See results”
  const current = queue[round];
  const result = results[round];
  const clean = results.filter((r) => !r.misses.length).length;
  const failed = results.filter((r) => r.misses.length).map((r) => r.line);

  return (
    <div>
      {back}
      <div className="row-between quiz-head">
        <h2>🧪 {title}</h2>
        <span className="muted">
          Line {Math.min(round + 1, queue.length)} of {queue.length} · {clean} passed
        </span>
      </div>
      {!finished && (
        <QuizRound
          key={round}
          line={current.line}
          color={current.color}
          // "my side": only lines played from this colour count as book moves (no straying into the other repertoire)
          lines={mode === 'own' ? lines.filter((l) => ownColor(l) === current.color) : lines}
          onDone={onDone}
        />
      )}
      {result && !finished && (
        <div className={`quiz-result ${result.misses.length ? 'bad' : 'good-result'}`}>
          <div>
            <b>{result.misses.length ? `✗ ${result.misses.length} mistake${result.misses.length > 1 ? 's' : ''}` : '✓ Passed'}</b>: {result.line.opening.name}, {result.line.name} (as {sideName(result.color)})
          </div>
          {result.misses.map((m) => (
            <div key={m.label} className="small">You missed <b>{m.label}</b>{m.comment ? `: ${m.comment}` : ''}</div>
          ))}
          <div><button className="btn-green" onClick={() => setRound(round + 1)}>{round + 1 < queue.length ? 'Next line →' : 'See results →'}</button></div>
        </div>
      )}
      {finished && (
        <div className="quiz-summary panel">
          <h2>{clean === results.length ? '🏆 Quiz passed!' : `${clean} of ${results.length} lines passed`}</h2>
          <p className="muted">{clean === results.length ? 'Every line from memory, without a mistake.' : 'Lines with mistakes come first next time. Study them, then retry.'}</p>
          <ul className="quiz-list">
            {results.map((r, i) => (
              <li key={i} className={r.misses.length ? 'bad' : 'ok'}>
                {r.misses.length ? '✗' : '✓'} {r.line.opening.name}: {r.line.name} <span className="muted">as {sideName(r.color)}</span>
                {r.misses.length > 0 && <span className="muted small"> · missed {r.misses.map((m) => m.label).join(', ')}</span>}
              </li>
            ))}
          </ul>
          <div className="row">
            {failed.length > 0 && <button className="btn-green" onClick={() => start(mode, failed)}>Retry the {failed.length} failed line{failed.length > 1 ? 's' : ''}</button>}
            <button className="btn-secondary" onClick={() => start(mode)}>New round</button>
            <button className="btn-secondary" onClick={() => { setMode(null); setQueue([]); }}>Change colour</button>
          </div>
        </div>
      )}
    </div>
  );
}
