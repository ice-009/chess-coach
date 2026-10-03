import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { getEngine } from '../lib/engine';
import type { EngineLine } from '../lib/engine';
import { formatScore, isLegalPosition, pvToSan, sideToMove } from '../lib/chess';
import { bookLookup } from '../lib/openingIndex';
import { winPct } from '../lib/analysis';
import { navigate } from '../lib/router';
import { Board } from '../components/Board';
import { EvalBar } from '../components/EvalBar';
import { MasterExplorer } from '../components/MasterExplorer';
import { fetchStatus } from '../lib/masterDb';
import { useFitTop } from '../lib/useFitTop';

const START = new Chess().fen();
const DEPTH = 18;

interface Hist {
  fens: string[];
  sans: string[];
  last: [string, string][];
}

export function ExplorePage({ initialFen }: { initialFen?: string }) {
  const fitRef = useFitTop<HTMLDivElement>();
  const startFen = useMemo(() => {
    try {
      return initialFen ? new Chess(initialFen).fen() : START;
    } catch {
      return START;
    }
  }, [initialFen]);
  const [hist, setHist] = useState<Hist>({ fens: [startFen], sans: [], last: [] });
  const [idx, setIdx] = useState(0);
  const [flip, setFlip] = useState(() => sideToMove(startFen) === 'b');
  const [result, setResult] = useState<{ fen: string; lines: EngineLine[] }>({ fen: '', lines: [] });
  const [fenInput, setFenInput] = useState('');
  const [fenError, setFenError] = useState('');
  const [dbReady, setDbReady] = useState(false);
  useEffect(() => {
    fetchStatus().then((st) => setDbReady(st.ready), () => setDbReady(false));
  }, []);

  const reset = (f: string) => {
    setHist({ fens: [f], sans: [], last: [] });
    setIdx(0);
  };

  const fen = hist.fens[idx];
  const game = useMemo(() => new Chess(fen), [fen]);

  // analyse the current position (debounced); leaving a position aborts its search
  useEffect(() => {
    if (game.isGameOver()) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      getEngine()
        .analyze(fen, DEPTH, 3, ctrl.signal)
        .then((r) => !ctrl.signal.aborted && setResult({ fen, lines: r.lines }));
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [fen, game]);

  const thinking = !game.isGameOver() && result.fen !== fen;
  const lines = result.fen === fen ? result.lines : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(hist.fens.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hist.fens.length]);

  function play(from: string, to: string, promotion = 'q'): boolean {
    const c = new Chess(fen);
    let m;
    try {
      m = c.move({ from, to, promotion });
    } catch {
      return false;
    }
    setHist((h) => ({
      fens: [...h.fens.slice(0, idx + 1), c.fen()],
      sans: [...h.sans.slice(0, idx), m.san],
      last: [...h.last.slice(0, idx), [from, to]],
    }));
    setIdx(idx + 1);
    return true;
  }

  function loadFen() {
    try {
      const f = new Chess(fenInput.trim()).fen();
      if (!isLegalPosition(f)) throw new Error('impossible position');
      setFenError('');
      navigate(`explore?fen=${encodeURIComponent(f)}`);
    } catch {
      setFenError('That FEN isn’t a valid, reachable position (check whose turn it is).');
    }
  }

  const turn = sideToMove(fen);
  const toWhite = (l: EngineLine) => ({ cp: l.cp === null ? null : turn === 'w' ? l.cp : -l.cp, mate: l.mate === null ? null : turn === 'w' ? l.mate : -l.mate });
  const top = lines[0] ? toWhite(lines[0]) : null;
  const whitePct = top ? (top.mate !== null ? (top.mate > 0 ? 100 : 0) : winPct(top.cp ?? 0)) : 50;
  const lastMove = idx > 0 ? hist.last[idx - 1] : null;
  const squares: Record<string, string> = lastMove ? { [lastMove[0]]: 'rgba(250,204,21,0.4)', [lastMove[1]]: 'rgba(250,204,21,0.4)' } : {};
  const arrows = lines.slice(0, 3).map((l, i): [string, string] => [l.pv[0], ['rgba(129,182,76,0.95)', 'rgba(129,182,76,0.55)', 'rgba(129,182,76,0.32)'][i]]).filter(([u]) => !!u);
  const book = bookLookup(fen);
  const status = game.isCheckmate() ? 'Checkmate' : game.isStalemate() ? 'Stalemate' : game.isDraw() ? 'Draw' : game.inCheck() ? 'Check!' : '';
  const startMoveNo = Number(startFen.split(' ')[5] ?? 1);
  const startBlack = sideToMove(startFen) === 'b';

  return (
    <div>
      <h1>Analysis Board</h1>
      <p className="muted">A free analysis board. Move pieces for both sides; Stockfish shows the three best moves as arrows, with the plan behind each one.</p>
      <div className="analysis" ref={fitRef}>
        <div>
          <div className="board-wrap">
            <EvalBar whitePct={top ? whitePct : null} label={top ? formatScore(top.cp, top.mate) : undefined} flipped={flip} />
            <Board id="explore-board" fen={fen} orientation={flip ? 'black' : 'white'} onMove={(f: Square, t: Square) => play(f, t)} squares={squares} arrows={arrows} />
          </div>
          <div className="nav">
            <button onClick={() => setIdx(0)} aria-label="Start">⏮</button>
            <button onClick={() => setIdx((i) => Math.max(0, i - 1))} aria-label="Back">◀</button>
            <button onClick={() => setIdx((i) => Math.min(hist.fens.length - 1, i + 1))} aria-label="Forward">▶</button>
            <button onClick={() => setIdx(hist.fens.length - 1)} aria-label="End">⏭</button>
            <button onClick={() => setFlip((f) => !f)}>⇅ Flip</button>
            <button onClick={() => reset(START)}>Reset</button>
            <button onClick={() => navigate(`practice?fen=${encodeURIComponent(fen)}`)}>Play vs computer</button>
          </div>
        </div>
        <div className="panel">
          <div className="row-between">
            <b>{turn === 'w' ? '⚪ White' : '⚫ Black'} to move</b>
            {status && <span className="warn">{status}</span>}
          </div>
          {book.length > 0 && (
            <div className="note">
              📖 Book:{' '}
              {book.slice(0, 3).map((b, i) => (
                <span key={b.openingId}>
                  {i > 0 && ', '}
                  <a href={`#/openings/${b.openingId}/${b.lineId}`}>{b.opening}</a>
                </span>
              ))}
              {book.length > 3 && ` +${book.length - 3} more`}
            </div>
          )}
          <div>
            <h3>Stockfish 19 {thinking && <span className="spinner tiny" />}</h3>
            {lines.length === 0 && !thinking && <div className="muted">{status || 'No moves.'}</div>}
            {lines.map((l, i) => {
              const w = toWhite(l);
              return (
                <button key={i} className="engine-line" onClick={() => l.pv[0] && play(l.pv[0].slice(0, 2), l.pv[0].slice(2, 4), l.pv[0][4])}>
                  <span className={`score ${(w.mate ?? w.cp ?? 0) >= 0 ? 'pos' : 'neg'}`}>{formatScore(w.cp, w.mate)}</span>
                  <span>{pvToSan(fen, l.pv)}</span>
                </button>
              );
            })}
            <div className="muted small">Depth {DEPTH}. Scores are from White’s point of view (+ = White is better). Click a line to play its first move.</div>
          </div>
          <div>
            <h3>Moves</h3>
            <div className="book">
              {hist.sans.length === 0 && <span className="muted">Make a move on the board.</span>}
              {hist.sans.map((san, i) => {
                const ply = i + (startBlack ? 1 : 0);
                const no = startMoveNo + Math.floor(ply / 2);
                return (
                  <span key={i}>
                    {ply % 2 === 0 && <span className="muted">{no}. </span>}
                    {i === 0 && startBlack && <span className="muted">{no}… </span>}
                    <button className={`move inline ${idx === i + 1 ? 'active' : ''}`} onClick={() => setIdx(i + 1)}>{san}</button>{' '}
                  </span>
                );
              })}
            </div>
          </div>
          {dbReady && (
            <div>
              <h3>Master games</h3>
              <MasterExplorer
                compact
                fens={hist.fens.slice(0, idx + 1)}
                onPlay={(san) => {
                  const m = new Chess(fen).move(san);
                  play(m.from, m.to, m.promotion);
                }}
                onOpenGame={(g) => navigate(`database/game/${g.id}?ply=${g.ply ?? 0}`)}
              />
            </div>
          )}
          <details>
            <summary>Load a position (FEN)</summary>
            <div className="search" style={{ marginTop: 8 }}>
              <input value={fenInput} onChange={(e) => setFenInput(e.target.value)} placeholder="Paste a FEN" aria-label="FEN" style={{ flex: 1 }} />
              <button onClick={loadFen}>Load</button>
            </div>
            {fenError && <div className="error">{fenError}</div>}
            <div className="muted small mono">{fen}</div>
          </details>
        </div>
      </div>
    </div>
  );
}
