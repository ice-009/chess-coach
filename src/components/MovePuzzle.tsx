import { useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { sideToMove } from '../lib/chess';
import { Board } from './Board';
import type { Promotion } from './Board';
import { playSound } from '../lib/sound';
import { Markdown } from './Markdown';

interface Props {
  id: string;
  fen: string;
  solutions: string[]; // SAN or UCI moves that count as correct
  prompt?: string;
  explain?: string;
  onDone?: (firstTry: boolean, revealed?: boolean) => void; // revealed: the answer was shown, not found
}

const strip = (san: string) => san.replace(/[+#!?]/g, '');

/** "Find the move" puzzle: the solver plays the side to move by dragging a piece. */
export function MovePuzzle({ id, fen, solutions, prompt, explain, onDone }: Props) {
  const [position, setPosition] = useState(fen);
  const [state, setState] = useState<'solving' | 'wrong' | 'solved' | 'revealed'>('solving');
  const [tries, setTries] = useState(0);
  const [last, setLast] = useState<[string, string] | null>(null);
  const [wrongSan, setWrongSan] = useState('');

  const orientation = sideToMove(fen) === 'w' ? 'white' : 'black';
  const answer = (() => {
    const c = new Chess(fen);
    for (const s of solutions) {
      try {
        const m = /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(s) ? c.move({ from: s.slice(0, 2), to: s.slice(2, 4), promotion: s[4] }) : c.move(s);
        return { san: m.san, uci: m.from + m.to };
      } catch {
        // try the next solution
      }
    }
    return null;
  })();

  function onMove(from: Square, to: Square, promotion: Promotion = 'q'): boolean {
    if (state === 'solved' || state === 'revealed') return false;
    const c = new Chess(fen);
    let m;
    try {
      m = c.move({ from, to, promotion });
    } catch {
      return false;
    }
    const ok = solutions.some((s) => strip(s) === strip(m.san) || s === m.from + m.to + (m.promotion ?? ''));
    setTries((t) => t + 1);
    if (ok) {
      window.setTimeout(() => playSound('correct'), 200);
      setPosition(c.fen());
      setLast([from, to]);
      setState('solved');
      onDone?.(tries === 0);
      return true;
    }
    playSound('wrong');
    setWrongSan(m.san);
    setState('wrong');
    return false;
  }

  function reveal() {
    setState('revealed');
    onDone?.(false, true);
  }

  const squares: Record<string, string> = last ? { [last[0]]: 'rgba(74,222,128,0.45)', [last[1]]: 'rgba(74,222,128,0.45)' } : {};

  return (
    <div className="puzzle">
      <div className="puzzle-board">
        <Board id={id} fen={position} orientation={orientation} onMove={onMove} squares={squares} arrows={state === 'revealed' && answer ? [answer.uci] : []} maxWidth={440} />
      </div>
      <div className="puzzle-side">
        <div className="turn">{orientation === 'white' ? '⚪ White' : '⚫ Black'} to move</div>
        {prompt && <p>{prompt}</p>}
        {state === 'solving' && <p className="muted">Drag a piece, or click it and then its destination.</p>}
        {state === 'wrong' && (
          <p className="warn">
            {wrongSan} isn’t it. Try again!{' '}
            {tries >= 2 && <button className="link" onClick={reveal}>Show answer</button>}
          </p>
        )}
        {state === 'solved' && <p className="good">✓ Correct!</p>}
        {state === 'revealed' && answer && <p className="warn">The answer was <b>{answer.san}</b>.</p>}
        {(state === 'solved' || state === 'revealed') && explain && <Markdown md={explain} />}
        {state === 'solving' && <button className="link" onClick={reveal}>I’m stuck, show me</button>}
      </div>
    </div>
  );
}
