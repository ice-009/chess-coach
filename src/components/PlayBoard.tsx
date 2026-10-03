import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { botMove, hintMove } from '../lib/bot';
import type { Level } from '../lib/bot';
import { useFitTop } from '../lib/useFitTop';
import { Board } from './Board';

export interface Goal {
  type: 'mate' | 'promote' | 'draw' | 'capture'; // capture: win every enemy piece and pawn (e.g. queen vs pawn)
  maxMoves?: number; // mate / promote / capture within this many of your moves
  surviveMoves?: number; // draw: hold for this many of your moves
}

export interface PlayResult {
  outcome: 'win' | 'loss' | 'draw';
  success?: boolean; // for drills: was the goal reached
  reason: string;
  sans: string[];
  fens: string[];
}

interface Props {
  startFen: string;
  userColor: 'w' | 'b';
  level: Level;
  goal?: Goal;
  onFinish?: (r: PlayResult) => void;
  children?: ReactNode; // extra side-panel content
}

/** A game against the bot from any position, optionally with a drill goal. */
export function PlayBoard({ startFen, userColor, level, goal, onFinish, children }: Props) {
  const fitRef = useFitTop<HTMLDivElement>();
  const [fens, setFens] = useState([startFen]);
  const [sans, setSans] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [thinking, setThinking] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const botScore = useRef(0); // the bot's last evaluation, from its own side
  const ctrl = useRef<AbortController | null>(null);
  const fen = fens[fens.length - 1];
  const turn = fen.split(' ')[1] as 'w' | 'b';
  const userMoves = Math.ceil((sans.length - (startFen.split(' ')[1] === userColor ? 0 : 1)) / 2);

  const finish = useCallback(
    (r: Omit<PlayResult, 'sans' | 'fens'>, s: string[], f: string[]) => {
      const full = { ...r, sans: s, fens: f };
      setResult(full);
      onFinish?.(full);
    },
    [onFinish],
  );

  /** Game-over and goal checks after every move. */
  const judge = useCallback(
    (c: Chess, s: string[], f: string[], moved: 'w' | 'b', lastSan: string): boolean => {
      const userMoved = moved === userColor;
      const mine = Math.ceil((s.length - (startFen.split(' ')[1] === userColor ? 0 : 1)) / 2);
      if (c.isCheckmate()) {
        const won = userMoved;
        finish({ outcome: won ? 'win' : 'loss', success: goal ? won && goal.type !== 'draw' : undefined, reason: won ? 'Checkmate! You won.' : 'Checkmate. You lost.' }, s, f);
        return true;
      }
      if (c.isDraw() || c.isStalemate()) {
        const why = c.isStalemate() ? 'Stalemate' : c.isInsufficientMaterial() ? 'Insufficient material' : c.isThreefoldRepetition() ? 'Threefold repetition' : '50-move rule';
        finish({ outcome: 'draw', success: goal ? goal.type === 'draw' : undefined, reason: `${why}: a draw.${goal && goal.type !== 'draw' ? ' Careful: that throws the win away.' : ''}` }, s, f);
        return true;
      }
      if (!goal) return false;
      if (goal.type === 'promote' && userMoved && /=Q/.test(lastSan)) {
        const to = c.history({ verbose: true }).at(-1)?.to;
        const enemy = userColor === 'w' ? 'b' : 'w';
        const safe = !to || c.attackers(to as Square, enemy).length === 0 || c.attackers(to as Square, userColor).length > 0;
        finish({ outcome: 'win', success: safe, reason: safe ? 'You promoted safely. Winning!' : 'You promoted, but the new queen can be taken.' }, s, f);
        return true;
      }
      if ((goal.type === 'draw' || goal.type === 'capture') && !userMoved && /=Q/.test(lastSan)) {
        // letting the pawn queen is fine when the new queen can be taken at once
        const to = c.history({ verbose: true }).at(-1)?.to;
        if (goal.type === 'capture' && to && c.attackers(to as Square, userColor).length > 0) return false;
        finish({ outcome: 'loss', success: false, reason: goal.type === 'draw' ? 'The pawn promoted. This position should have been a draw.' : 'The pawn promoted. Keep checking until the king has to stand in front of its pawn.' }, s, f);
        return true;
      }
      if (goal.type === 'capture' && userMoved) {
        const enemy = userColor === 'w' ? 'b' : 'w';
        if (!c.board().flat().some((p) => p && p.color === enemy && p.type !== 'k')) {
          finish({ outcome: 'win', success: true, reason: 'You won the last pawn: now it is queen against a lone king, a sure win. Well done!' }, s, f);
          return true;
        }
      }
      if ((goal.type === 'mate' || goal.type === 'promote' || goal.type === 'capture') && goal.maxMoves && userMoved && mine >= goal.maxMoves) {
        finish({ outcome: 'draw', success: false, reason: `Out of moves: the goal was to finish within ${goal.maxMoves} moves. Try a more direct plan.` }, s, f);
        return true;
      }
      if (goal.type === 'draw' && goal.surviveMoves && userMoved && mine >= goal.surviveMoves) {
        const held = botScore.current < 300;
        finish({ outcome: 'draw', success: held, reason: held ? `You held the draw for ${goal.surviveMoves} moves!` : 'You survived, but the position is now lost.' }, s, f);
        return true;
      }
      return false;
    },
    [finish, goal, startFen, userColor],
  );

  const apply = useCallback(
    (move: { from: string; to: string; promotion?: string }) => {
      const c = new Chess(fen);
      let m;
      try {
        m = c.move(move);
      } catch {
        return null;
      }
      const s = [...sans, m.san];
      const f = [...fens, c.fen()];
      setSans(s);
      setFens(f);
      setLastMove([m.from, m.to]);
      setHint(null);
      setMessage('');
      judge(c, s, f, m.color, m.san);
      return m;
    },
    [fen, fens, sans, judge],
  );

  // the bot moves whenever it is its turn
  useEffect(() => {
    if (result || turn === userColor) return;
    const c = new AbortController();
    ctrl.current = c;
    setThinking(true);
    const started = Date.now();
    botMove(fen, level, c.signal).then(({ move, score }) => {
      if (c.signal.aborted || !move) return;
      botScore.current = score;
      window.setTimeout(() => {
        if (c.signal.aborted) return;
        setThinking(false);
        apply({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
      }, Math.max(0, 450 - (Date.now() - started)));
    });
    return () => c.abort();
  }, [fen, result, turn, userColor, level, apply]);

  const onMove = (from: Square, to: Square) => {
    if (result || turn !== userColor || thinking) return false;
    return !!apply({ from, to, promotion: 'q' });
  };

  function takeback() {
    ctrl.current?.abort();
    setThinking(false);
    // undo back to your last turn
    let n = fens.length - 1;
    if (n === 0) return;
    n -= 1;
    if ((fens[n].split(' ')[1] as 'w' | 'b') !== userColor && n > 0) n -= 1;
    setFens(fens.slice(0, n + 1));
    setSans(sans.slice(0, n));
    setLastMove(null);
    setMessage('Move taken back.');
  }

  const squares = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (lastMove) {
      out[lastMove[0]] = 'rgba(255,255,51,0.45)';
      out[lastMove[1]] = 'rgba(255,255,51,0.45)';
    }
    return out;
  }, [lastMove]);
  const arrows = useMemo(() => (hint ? [[hint, 'rgba(129,182,76,0.9)'] as [string, string]] : []), [hint]);
  const inCheck = new Chess(fen).inCheck();

  return (
    <div className="puzzle-play" ref={fitRef}>
      <div className="puzzle-board">
        <Board id="play-board" fen={fen} orientation={userColor === 'w' ? 'white' : 'black'} onMove={result ? undefined : onMove} squares={squares} arrows={arrows} maxWidth={600} />
      </div>
      <div className="puzzle-side panel">
        <div className={`puzzle-status ${result ? (result.success === false || result.outcome === 'loss' ? 'wrong' : 'solved') : ''}`}>
          {result ? (
            <>
              <span className={`mark ${result.success === false || result.outcome === 'loss' ? 'bad' : 'good'}`}>{result.success === false || result.outcome === 'loss' ? '✕' : '✓'}</span>
              <b>{result.reason}</b>
            </>
          ) : (
            <>
              <span className={`turn-dot ${turn}`} />
              <div>
                <b>{turn === userColor ? (inCheck ? 'Check! Your move' : 'Your move') : `${level.name} is thinking…`}</b>
                {goal && (
                  <div className="muted small">
                    {goal.type === 'mate' && `Checkmate within ${goal.maxMoves} moves (move ${userMoves} so far)`}
                    {goal.type === 'promote' && `Promote safely within ${goal.maxMoves} moves (move ${userMoves})`}
                    {goal.type === 'draw' && `Hold the draw for ${goal.surviveMoves} moves (move ${userMoves})`}
                    {goal.type === 'capture' && `Win the pawn within ${goal.maxMoves} moves (move ${userMoves})`}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        {message && <div className="muted small">{message}</div>}
        {!result && (
          <div className="row">
            <button className="btn-secondary" disabled={turn !== userColor || thinking} onClick={() => hintMove(fen).then((m) => setHint(m))}>💡 Hint</button>
            <button className="btn-secondary" onClick={takeback} disabled={sans.length === 0}>↶ Take back</button>
            <button className="btn-secondary" onClick={() => finish({ outcome: 'loss', success: goal ? false : undefined, reason: 'You resigned.' }, sans, fens)}>Resign</button>
          </div>
        )}
        <div className="book play-moves">
          {sans.map((san, i) => {
            const startBlack = startFen.split(' ')[1] === 'b';
            const ply = i + (startBlack ? 1 : 0);
            const no = Number(startFen.split(' ')[5] ?? 1) + Math.floor(ply / 2);
            return (
              <span key={i}>
                {ply % 2 === 0 && <span className="muted">{no}. </span>}
                {i === 0 && startBlack && <span className="muted">{no}… </span>}
                <span className="move inline">{san}</span>{' '}
              </span>
            );
          })}
        </div>
        {children}
      </div>
    </div>
  );
}
