import { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { getEngine } from '../lib/engine';
import { winPct } from '../lib/analysis';
import { playSound } from '../lib/sound';
import { Board } from './Board';
import type { Promotion } from './Board';

type Status = 'try' | 'checking' | 'wrong' | 'right' | 'alt' | 'shown';

const play = (fen: string, uci: string) => {
  try {
    const c = new Chess(fen);
    const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return { fen: c.fen(), san: m.san };
  } catch {
    return null;
  }
};

/**
 * A position from one of your games: find a better move than the one you played. The engine's move counts, and so
 * does any move it rates almost as highly (within 5% winning chances).
 */
export function FindBetterMove({
  id,
  fen,
  best,
  played,
  explain,
  source,
  onDone,
}: {
  id: string;
  fen: string;
  best: string; // UCI
  played?: string; // UCI of the move from the game
  explain?: string;
  source?: string;
  onDone: (r: { correct: boolean; firstTry: boolean }) => void;
}) {
  const [board, setBoard] = useState(fen);
  const [status, setStatus] = useState<Status>('try');
  const [tries, setTries] = useState(0);
  const [tried, setTried] = useState('');
  const bestSan = useMemo(() => play(fen, best)?.san ?? best, [fen, best]);
  const playedSan = useMemo(() => (played ? (play(fen, played)?.san ?? played) : ''), [fen, played]);
  const side = fen.split(' ')[1] === 'w' ? 'White' : 'Black';
  const finished = status === 'right' || status === 'alt' || status === 'shown';

  function finish(correct: boolean) {
    onDone({ correct, firstTry: tries === 0 });
  }

  function onMove(from: Square, to: Square, promotion: Promotion = 'q'): boolean {
    if (finished || status === 'checking') return false;
    let m;
    try {
      m = new Chess(fen).move({ from, to, promotion });
    } catch {
      return false;
    }
    const uci = m.from + m.to + (m.promotion ?? '');
    setTried(m.san);
    if (uci === best) {
      setBoard(play(fen, uci)!.fen);
      setStatus('right');
      window.setTimeout(() => playSound('correct'), 200);
      finish(true);
      return true;
    }
    if (uci === played) {
      setStatus('wrong');
      setTries((t) => t + 1);
      playSound('wrong');
      return false;
    }
    // another move: good enough if the engine rates it almost as highly as the best one
    setStatus('checking');
    setBoard(play(fen, uci)!.fen);
    const engine = getEngine();
    Promise.all([engine.analyze(fen, 12), engine.analyze(play(fen, uci)!.fen, 12)]).then(([a, b]) => {
      const score = (r: { cp: number | null; mate: number | null }) => (r.mate !== null ? (r.mate > 0 ? 10000 : -10000) : (r.cp ?? 0));
      const loss = winPct(score(a)) - (100 - winPct(score(b)));
      if (loss < 5) {
        setStatus('alt');
        window.setTimeout(() => playSound('correct'), 200);
        onDone({ correct: true, firstTry: tries === 0 });
      } else {
        setBoard(fen);
        setStatus('wrong');
        setTries((t) => t + 1);
        playSound('wrong');
      }
    });
    return true;
  }

  function show() {
    setBoard(play(fen, best)?.fen ?? fen);
    setStatus('shown');
    finish(false);
  }

  const arrows = useMemo(() => (status === 'shown' ? [[best, 'rgba(129,182,76,0.9)'] as [string, string]] : []), [status, best]);

  return (
    <div className="find-move" data-status={status}>
      <div className="find-board">
        <Board id={id} fen={board} orientation={side === 'White' ? 'white' : 'black'} onMove={finished ? undefined : onMove} arrows={arrows} maxWidth={560} />
      </div>
      <div className="find-side">
        {source && <div className="muted small">{source}</div>}
        <div className={`quick-task ${status === 'wrong' ? 'wrong' : ''}`}>
          {status === 'try' && <><b>Find a better move for {side}.</b>{playedSan && <> In the game you played {playedSan}.</>}</>}
          {status === 'checking' && <><span className="spinner tiny" /> Checking {tried}…</>}
          {status === 'wrong' && <><b>✗ {tried} isn’t better.</b> {tried === playedSan ? 'That’s the move from the game. ' : ''}Look for checks, captures and threats{tries >= 2 ? ', or see the answer.' : '.'}</>}
          {status === 'right' && <b>✓ {tried}, the best move!</b>}
          {status === 'alt' && <b>✓ {tried} works too. Stockfish’s first choice was {bestSan}.</b>}
          {status === 'shown' && <b>The better move was {bestSan}.</b>}
        </div>
        {finished && explain && <p className="quick-explain">{explain}</p>}
        {!finished && <div className="row"><button className={tries >= 2 ? 'btn-green' : 'btn-secondary'} onClick={show}>Show me</button></div>}
      </div>
    </div>
  );
}
