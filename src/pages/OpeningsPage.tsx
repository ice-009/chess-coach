import { useEffect, useMemo, useRef, useState } from 'react';
import type { Square } from 'chess.js';
import { GROUPS, OPENINGS, findOpening, groupTitle } from '../data/openings';
import { ENCYCLOPEDIA, ENC_GROUPS } from '../data/encyclopedia';
import type { Opening, OpeningLine } from '../data/openings';
import { parseLine } from '../lib/chess';
import type { MoveNode } from '../lib/chess';
import { navigate } from '../lib/router';
import { KEYS, load, save } from '../lib/storage';
import { logActivity } from '../lib/activity';
import { Board } from '../components/Board';
import { useFitTop } from '../lib/useFitTop';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const fenAt = (moves: MoveNode[], ply: number) => (ply === 0 ? START : moves[ply - 1].fenAfter);

function useDrillStats() {
  const [stats, setStats] = useState<Record<string, number>>(() => load(KEYS.openingsDone, {}));
  const bump = (id: string) => {
    logActivity('opening');
    const next = { ...stats, [id]: (stats[id] ?? 0) + 1 };
    save(KEYS.openingsDone, next);
    setStats(next);
  };
  return { stats, bump };
}

function MoveText({ moves, ply, onSelect, showComments }: { moves: MoveNode[]; ply: number; onSelect: (p: number) => void; showComments: boolean }) {
  return (
    <div className="book">
      {moves.map((m, i) => (
        <span key={i}>
          {i % 2 === 0 && <span className="muted">{i / 2 + 1}. </span>}
          <button className={`move inline ${ply === i + 1 ? 'active' : ''}`} onClick={() => onSelect(i + 1)}>{m.san}</button>{' '}
          {showComments && m.comment && <span className="book-note">{m.comment} </span>}
        </span>
      ))}
    </div>
  );
}

function Study({ opening, moves }: { opening: Opening; moves: MoveNode[] }) {
  const [ply, setPly] = useState(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setPly((p) => Math.max(0, p - 1));
      if (e.key === 'ArrowRight') setPly((p) => Math.min(moves.length, p + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moves.length]);
  const last = ply > 0 ? moves[ply - 1] : null;
  const squares: Record<string, string> = last ? { [last.from]: 'rgba(250,204,21,0.4)', [last.to]: 'rgba(250,204,21,0.4)' } : {};

  return (
    <>
      <div className="op-board">
        <Board id="study-board" fen={fenAt(moves, ply)} orientation={opening.side} squares={squares} maxWidth={560} />
        <div className="nav">
          <button onClick={() => setPly(0)} aria-label="Start">⏮</button>
          <button onClick={() => setPly((p) => Math.max(0, p - 1))} aria-label="Back">◀</button>
          <button onClick={() => setPly((p) => Math.min(moves.length, p + 1))} aria-label="Forward">▶</button>
          <button onClick={() => setPly(moves.length)} aria-label="End">⏭</button>
        </div>
      </div>
      <div className="panel op-panel">
        <div className="note big-note">
          {last ? (
            <>
              <b>{Math.ceil(ply / 2)}{ply % 2 ? '.' : '…'} {last.san}</b> {last.comment ?? ''}
            </>
          ) : (
            'Press ▶ or the → key to step through the line. Each important move is explained.'
          )}
        </div>
        <MoveText moves={moves} ply={ply} onSelect={setPly} showComments />
        <div className="row">
          <button onClick={() => navigate(`explore?fen=${encodeURIComponent(fenAt(moves, ply))}`)}>Analyse with the engine →</button>
          <button onClick={() => navigate(`database?line=${encodeURIComponent(moves.slice(0, ply).map((m) => m.san).join(','))}`)}>Master games from here →</button>
        </div>
      </div>
    </>
  );
}

function Drill({ opening, line, moves, onComplete }: { opening: Opening; line: OpeningLine; moves: MoveNode[]; onComplete: (clean: boolean) => void }) {
  const myColor = opening.side === 'white' ? 'w' : 'b';
  const [ply, setPly] = useState(0);
  const [wrong, setWrong] = useState(0); // wrong tries on the current move
  const [mistakes, setMistakes] = useState(0);
  const [feedback, setFeedback] = useState('');
  const done = ply >= moves.length;
  const myTurn = !done && moves[ply].fenBefore.split(' ')[1] === myColor;

  // the computer plays the opponent's moves
  useEffect(() => {
    if (done || myTurn) return;
    const t = setTimeout(() => setPly((p) => p + 1), 450);
    return () => clearTimeout(t);
  }, [ply, done, myTurn]);

  // report completion once, when the last move of the line is played
  const reported = useRef(false);
  useEffect(() => {
    if (!done || reported.current) return;
    reported.current = true;
    onComplete(mistakes === 0);
  }, [done, mistakes, onComplete]);

  function onMove(from: Square, to: Square): boolean {
    if (!myTurn) return false;
    const expected = moves[ply];
    if (from === expected.from && to === expected.to) {
      setFeedback(expected.comment ? `✓ ${expected.san}: ${expected.comment}` : `✓ ${expected.san}`);
      setWrong(0);
      setPly(ply + 1);
      return true;
    }
    setMistakes((m) => m + 1);
    setWrong((w) => w + 1);
    setFeedback(wrong === 0 ? 'Not the move in this line. Think about the ideas and try again.' : `The line continues ${expected.san}. Play it to continue.`);
    return false;
  }

  function restart() {
    reported.current = false;
    setPly(0);
    setWrong(0);
    setMistakes(0);
    setFeedback('');
  }

  const last = ply > 0 ? moves[ply - 1] : null;
  const squares: Record<string, string> = last ? { [last.from]: 'rgba(250,204,21,0.4)', [last.to]: 'rgba(250,204,21,0.4)' } : {};
  const hint = myTurn && wrong >= 2 ? [moves[ply].uci] : [];

  return (
    <>
      <div className="op-board">
        <Board id="drill-board" fen={fenAt(moves, ply)} orientation={opening.side} onMove={onMove} squares={squares} arrows={hint} maxWidth={560} />
      </div>
      <div className="panel op-panel">
        <h3>Drill: {line.name}</h3>
        <div className="muted small">You play {opening.side}. The computer plays the other side’s book moves.</div>
        <div className="progress"><div style={{ width: `${(ply / moves.length) * 100}%` }} /></div>
        {done ? (
          <div className={mistakes ? 'warn' : 'good'}>
            {mistakes ? `Line complete with ${mistakes} slip${mistakes > 1 ? 's' : ''}. Run it again until it’s clean!` : '✓ Perfect! You played the whole line from memory.'}
            <div style={{ marginTop: 8 }}>
              <button className="link" onClick={() => navigate(`practice?fen=${encodeURIComponent(fenAt(moves, moves.length))}&color=${myColor}`)}>
                Play on from here against the computer →
              </button>
            </div>
          </div>
        ) : (
          <div className="turn">{myTurn ? 'Your move' : 'Opponent is thinking…'}</div>
        )}
        {feedback && <div className="note">{feedback}</div>}
        <button onClick={restart}>↺ Restart line</button>
      </div>
    </>
  );
}

function OpeningView({ opening, lineId, mode }: { opening: Opening; lineId?: string; mode: string }) {
  const line = opening.lines.find((l) => l.id === lineId) ?? opening.lines[0];
  const moves = useMemo(() => parseLine(line.moves), [line.moves]);
  const { stats, bump } = useDrillStats();
  const fitRef = useFitTop<HTMLDivElement>();
  const encyclopedia = opening.group.startsWith('enc-');
  const go = (l: string, m: string) => navigate(`openings/${opening.id}/${l}?mode=${m}`);

  return (
    <div>
      <button onClick={() => navigate(encyclopedia ? 'openings?view=encyclopedia' : 'openings')}>← {encyclopedia ? 'Encyclopedia' : 'All openings'}</button>
      {/* title and controls, then board + drill/study panel, then the background reading (placed by CSS grid areas) */}
      <div className="opening-layout" ref={fitRef}>
        <div className="op-head">
          <div className="eyebrow">{groupTitle(opening.group)} · ECO {opening.eco} · {encyclopedia ? `seen from ${opening.side}’s side` : `you play ${opening.side}`}</div>
          <h1>{opening.name}</h1>
          <div className="line-tabs">
            {opening.lines.map((l) => (
              <button key={l.id} className={`chip ${l.id === line.id ? 'on' : ''}`} onClick={() => go(l.id, mode)}>
                {l.name} {stats[l.id] ? <span className="good">✓{stats[l.id]}</span> : null}
              </button>
            ))}
          </div>
          <div className="seg">
            <button className={mode !== 'drill' ? 'on' : ''} onClick={() => go(line.id, 'study')}>📖 Study</button>
            <button className={mode === 'drill' ? 'on' : ''} onClick={() => go(line.id, 'drill')}>🎯 Drill</button>
          </div>
        </div>

        {mode === 'drill' ? (
          <Drill key={line.id} opening={opening} line={line} moves={moves} onComplete={(clean) => clean && bump(line.id)} />
        ) : (
          <Study key={line.id} opening={opening} moves={moves} />
        )}

        <div className="op-about">
          <p>{opening.summary}</p>
          <details className="ideas" open>
            <summary>Key ideas</summary>
            <ul>{opening.ideas.map((i) => <li key={i}>{i}</li>)}</ul>
          </details>
        </div>
      </div>
    </div>
  );
}

export function OpeningsPage({ openingId, lineId, mode, view }: { openingId?: string; lineId?: string; mode: string; view?: string }) {
  const { stats } = useDrillStats();
  if (openingId) {
    const o = findOpening(openingId);
    return o ? <OpeningView opening={o} lineId={lineId} mode={mode} /> : <div className="error">Opening not found.</div>;
  }
  const encyclopedia = view === 'encyclopedia';
  const groups = encyclopedia ? ENC_GROUPS : GROUPS;
  const list = encyclopedia ? ENCYCLOPEDIA : OPENINGS;
  const lineCount = ENCYCLOPEDIA.reduce((n, o) => n + o.lines.length, 0);
  return (
    <div>
      <h1>Openings</h1>
      <div className="seg">
        <button className={!encyclopedia ? 'on' : ''} onClick={() => navigate('openings')}>⭐ My repertoire</button>
        <button className={encyclopedia ? 'on' : ''} onClick={() => navigate('openings?view=encyclopedia')}>📚 Encyclopedia</button>
      </div>
      {encyclopedia ? (
        <p className="muted">
          The main lines of {ENCYCLOPEDIA.length} major openings ({lineCount} lines), explained move by move, with the plans for both sides. Every move is
          played by masters (checked against the master database) and sound (checked by Stockfish). <b>Study</b> a line, then <b>Drill</b> it, or open
          the <b>master games</b> that followed it.
        </p>
      ) : (
        <p className="muted">A complete, beginner-friendly repertoire. <b>Study</b> a line to understand the ideas, then <b>Drill</b> it: you play your side, the computer plays the other, until you know it cold.</p>
      )}
      {groups.map((g) => (
        <section key={g.id} className="chapter">
          <h2>{g.title}</h2>
          <p className="muted">{g.blurb}</p>
          <div className="cards">
            {list.filter((o) => o.group === g.id).map((o) => {
              const drilled = o.lines.filter((l) => stats[l.id]).length;
              return (
                <button key={o.id} className="card" onClick={() => navigate(`openings/${o.id}`)}>
                  <div className="card-title">{o.name}</div>
                  <div className="muted small">{o.eco} · {o.lines.length} line{o.lines.length > 1 ? 's' : ''} · {drilled}/{o.lines.length} drilled</div>
                  <div className="card-body">{o.summary}</div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
