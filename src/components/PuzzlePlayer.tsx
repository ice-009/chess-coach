import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import type { Puzzle } from '../lib/puzzles';
import { useFitTop } from '../lib/useFitTop';
import { Board } from './Board';
import { playSound } from '../lib/sound';
import type { Promotion } from './Board';

export interface PuzzleResult {
  solved: boolean; // solved with no wrong move, hint or peek
}

interface Props {
  puzzle: Puzzle;
  onDone: (r: PuzzleResult) => void;
  showRating?: boolean; // reveal the puzzle's rating only after it is done
  compact?: boolean;
  failFast?: boolean; // Rush: the first wrong move ends the puzzle
  children?: ReactNode; // extra panel content (rating, next button…)
}

const uciOf = (m: { from: string; to: string; promotion?: string }) => m.from + m.to + (m.promotion ?? '');

/** Plays a Lichess-style puzzle: the first move is the opponent's, then you find the rest. */
export function PuzzlePlayer({ puzzle, onDone, showRating = true, compact, failFast, children }: Props) {
  const fitRef = useFitTop<HTMLDivElement>();
  const [ply, setPly] = useState(0); // moves of puzzle.moves already on the board
  const [fen, setFen] = useState(puzzle.fen);
  const [status, setStatus] = useState<'intro' | 'solving' | 'wrong' | 'solved' | 'shown'>('intro');
  const [hint, setHint] = useState(false);
  const [assisted, setAssisted] = useState(false); // a wrong move, hint or peek happened (for display)
  const failed = useRef(false); // same, readable synchronously inside handlers
  const reported = useRef(false);
  const timers = useRef<number[]>([]);

  const solver = useMemo(() => (puzzle.fen.split(' ')[1] === 'w' ? 'b' : 'w'), [puzzle.fen]);
  const lastMove = ply > 0 ? puzzle.moves[ply - 1] : null;

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const finish = useCallback(
    (solved: boolean) => {
      if (reported.current) return;
      reported.current = true;
      onDone({ solved: solved && !failed.current });
    },
    [onDone],
  );

  // the opponent's move that sets up the puzzle
  useEffect(() => {
    const t = window.setTimeout(() => {
      const c = new Chess(puzzle.fen);
      const u = puzzle.moves[0];
      c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      setFen(c.fen());
      setPly(1);
      setStatus('solving');
    }, 600);
    return () => clearTimeout(t);
  }, [puzzle]);

  function onMove(from: Square, to: Square, promotion: Promotion = 'q'): boolean {
    if (status !== 'solving' && status !== 'wrong') return false;
    const expected = puzzle.moves[ply];
    const c = new Chess(fen);
    let m;
    try {
      m = c.move({ from, to, promotion });
    } catch {
      return false;
    }
    const correct = uciOf(m) === expected || c.isCheckmate(); // any mate is accepted, like Lichess
    if (!correct) {
      playSound('wrong');
      failed.current = true;
      setAssisted(true);
      setStatus(failFast ? 'shown' : 'wrong');
      if (failFast) finish(false);
      return false;
    }
    setHint(false);
    setFen(c.fen());
    const nextPly = ply + 1;
    setPly(nextPly);
    if (nextPly >= puzzle.moves.length || c.isCheckmate()) {
      window.setTimeout(() => playSound('correct'), 200); // after the move's own sound
      setStatus('solved');
      finish(true);
      return true;
    }
    setStatus('solving');
    later(() => {
      const reply = puzzle.moves[nextPly];
      const r = new Chess(c.fen());
      r.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] });
      setFen(r.fen());
      setPly(nextPly + 1);
    }, 350);
    return true;
  }

  function showSolution() {
    failed.current = true;
    setAssisted(true);
    setStatus('shown');
    finish(false); // record the miss now, even if the player leaves before the animation ends
    const c = new Chess(fen);
    puzzle.moves.slice(ply).forEach((u, i) => {
      later(() => {
        c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
        setFen(c.fen());
        setPly(ply + i + 1);
      }, 650 * (i + 1));
    });
  }

  const squares = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (lastMove) {
      out[lastMove.slice(0, 2)] = 'rgba(255,255,51,0.45)';
      out[lastMove.slice(2, 4)] = 'rgba(255,255,51,0.45)';
    }
    if (hint && status !== 'solved' && status !== 'shown' && puzzle.moves[ply]) out[puzzle.moves[ply].slice(0, 2)] = 'rgba(129,182,76,0.7)';
    return out;
  }, [lastMove, hint, status, puzzle.moves, ply]);

  const done = status === 'solved' || status === 'shown';
  return (
    <div className={`puzzle-play ${compact ? 'compact' : ''}`} ref={fitRef} data-puzzle={puzzle.id} data-themes={puzzle.themes.join(' ')}>
      <div className="puzzle-board">
        <Board id="puzzle-board" fen={fen} orientation={solver === 'w' ? 'white' : 'black'} onMove={done ? undefined : onMove} squares={squares} maxWidth={600} />
      </div>
      <div className="puzzle-side panel">
        <div className={`puzzle-status ${status}`}>
          {status === 'intro' && <span className="muted">Watch your opponent’s move…</span>}
          {status === 'solving' && (
            <>
              <span className={`turn-dot ${solver}`} />
              <div>
                <b>Your turn</b>
                <div className="muted small">Find the best move for {solver === 'w' ? 'White' : 'Black'}.</div>
              </div>
            </>
          )}
          {status === 'wrong' && (
            <>
              <span className="mark bad">✕</span>
              <div>
                <b>That’s not the move</b>
                <div className="muted small">Try again: checks, captures, threats.</div>
              </div>
            </>
          )}
          {status === 'solved' && (
            <>
              <span className="mark good">✓</span>
              <div>
                <b>{assisted ? 'Solved (with help)' : 'Solved!'}</b>
                {showRating && <div className="muted small">Puzzle rated {puzzle.rating}</div>}
              </div>
            </>
          )}
          {status === 'shown' && (
            <>
              <span className="mark bad">✕</span>
              <div>
                <b>Here’s the solution</b>
                {showRating && <div className="muted small">Puzzle rated {puzzle.rating}. It will come back in your review queue.</div>}
              </div>
            </>
          )}
        </div>
        {!done && status !== 'intro' && (
          <div className="row">
            <button
              className="btn-secondary"
              onClick={() => {
                failed.current = true; // a hinted solve doesn't count as clean
                setAssisted(true);
                setHint(true);
              }}
              disabled={hint}
            >
              💡 Hint
            </button>
            <button className="btn-secondary" onClick={showSolution}>Show solution</button>
          </div>
        )}
        {done && puzzle.themes.length > 0 && (
          <div className="chips">
            {puzzle.themes.filter((t) => !['short', 'long', 'veryLong', 'oneMove', 'master', 'masterVsMaster', 'superGM', 'crushing', 'advantage', 'equality'].includes(t)).map((t) => (
              <span key={t} className="tag">{t.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
            ))}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
