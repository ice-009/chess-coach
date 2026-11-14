import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { botMove, hintMove, thinkTime } from '../lib/bot';
import type { Bot, Level } from '../lib/bot';
import { grade, hint as coachHint, threat as coachThreat, evaluate } from '../lib/liveCoach';
import type { Grade } from '../lib/liveCoach';
import { useFitTop } from '../lib/useFitTop';
import { getMe } from '../lib/storage';
import { CLASS_META } from '../lib/classMeta';
import { Board } from './Board';
import { Captured } from './Captured';
import { ClassIcon } from './icons';
import { playSound } from '../lib/sound';
import type { Classification } from '../lib/analysis';
import type { Promotion } from './Board';

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
  grades?: (Classification | null)[]; // the coach's grade of each of your moves (null for the bot's)
  takebacks?: number;
}

export interface TimeControl {
  base: number; // seconds
  inc: number;
}

interface Props {
  startFen: string;
  userColor: 'w' | 'b';
  level: Level | Bot;
  goal?: Goal;
  coach?: boolean; // the live coach: grades, threat warnings, blunder take-backs, step-by-step hints
  clock?: TimeControl | null;
  onFinish?: (r: PlayResult) => void;
  children?: ReactNode; // extra side-panel content
}

interface CoachMsg {
  id: number;
  kind: 'grade' | 'threat' | 'hint' | 'bot' | 'info';
  text: string;
  c?: Classification;
}

const START = new Chess().fen();
const isBot = (l: Level | Bot): l is Bot => 'slug' in l;
const fmt = (ms: number) => {
  const s = Math.max(0, ms) / 1000;
  if (s < 20) return s.toFixed(1);
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
let msgId = 0;

/** A game against the bot from any position, optionally with a drill goal, a clock and the live coach. */
export function PlayBoard({ startFen, userColor, level, goal, coach = false, clock = null, onFinish, children }: Props) {
  const fitRef = useFitTop<HTMLDivElement>();
  const [fens, setFens] = useState([startFen]);
  const [sans, setSans] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [arrow, setArrow] = useState<string | null>(null);
  const [hintSquare, setHintSquare] = useState<string | null>(null);
  const [hintStep, setHintStep] = useState(0);
  const [message, setMessage] = useState('');
  // coach state
  const [feed, setFeed] = useState<CoachMsg[]>(() => (isBot(level) ? [{ id: ++msgId, kind: 'bot', text: level.greet }] : []));
  const [checking, setChecking] = useState(false);
  const [warning, setWarning] = useState<Grade | null>(null);
  const [badge, setBadge] = useState<{ square: string; c: Classification } | null>(null);
  const [grades, setGrades] = useState<(Classification | null)[]>([]);
  const takebacks = useRef(0);
  // clocks, in ms
  const [clocks, setClocks] = useState(() => ({ w: (clock?.base ?? 0) * 1000, b: (clock?.base ?? 0) * 1000 }));
  const clocksRef = useRef(clocks);
  useEffect(() => {
    clocksRef.current = clocks;
  }, [clocks]);

  const botScore = useRef(0); // the bot's last evaluation, from its own side
  const ctrl = useRef<AbortController | null>(null);
  const fen = fens[fens.length - 1];
  const fensLen = useRef(fens.length);
  useEffect(() => {
    fensLen.current = fens.length;
  }, [fens.length]);
  const turn = fen.split(' ')[1] as 'w' | 'b';
  const userMoves = Math.ceil((sans.length - (startFen.split(' ')[1] === userColor ? 0 : 1)) / 2);
  const paused = checking || !!warning; // the coach is looking at your move: the bot (and your clock) wait
  const thinking = !result && turn !== userColor && !paused; // the bot is on move
  const say = useCallback((m: Omit<CoachMsg, 'id'>) => setFeed((f) => [...f.slice(-30), { ...m, id: ++msgId }]), []);

  const finish = useCallback(
    (r: Omit<PlayResult, 'sans' | 'fens'>, s: string[], f: string[]) => {
      const full = { ...r, sans: s, fens: f, grades, takebacks: takebacks.current };
      setResult(full);
      setWarning(null);
      if (isBot(level)) {
        const line = r.outcome === 'win' ? level.onLose : r.outcome === 'loss' ? level.onWin : 'A draw. Good fight!';
        setFeed((fd) => [...fd, { id: ++msgId, kind: 'bot', text: line }]);
      }
      onFinish?.(full);
    },
    [onFinish, grades, level],
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
      setArrow(null);
      setHintSquare(null);
      setHintStep(0);
      setMessage('');
      if (clock) setClocks((k) => ({ ...k, [m.color]: k[m.color] + clock.inc * 1000 }));
      const over = judge(c, s, f, m.color, m.san);
      return { m, over, before: fen, after: c.fen(), s };
    },
    [fen, fens, sans, judge, clock],
  );

  // ── the clock: whoever is to move loses time (yours stops while the coach checks your move) ──
  useEffect(() => {
    if (!clock || result || sans.length === 0) return; // starts with the first move, like online
    let last = performance.now();
    const t = setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      if (paused) return;
      const side = turn;
      const left = clocksRef.current[side] - dt;
      setClocks((k) => ({ ...k, [side]: Math.max(0, left) }));
      if (left <= 0) {
        playSound('end');
        const userFlagged = side === userColor;
        finish({ outcome: userFlagged ? 'loss' : 'win', reason: userFlagged ? 'You ran out of time.' : `${level.name} ran out of time. You win!` }, sans, fens);
      }
    }, 100);
    return () => clearInterval(t);
  }, [clock, result, sans, fens, turn, paused, userColor, finish, level.name]);

  // ── the bot moves whenever it is its turn ──
  useEffect(() => {
    if (result || turn === userColor || paused) return;
    const c = new AbortController();
    ctrl.current = c;
    const started = Date.now();
    const history = startFen === START ? sans : undefined;
    botMove(fen, level, c.signal, history).then(({ move, score }) => {
      if (c.signal.aborted || !move) return;
      botScore.current = score;
      const wait = clock ? thinkTime(level, clocksRef.current[turn]) : 450;
      window.setTimeout(() => {
        if (c.signal.aborted) return;
        apply({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
        setGrades((g) => [...g, null]);
      }, Math.max(0, wait - (Date.now() - started)));
    });
    return () => c.abort();
  }, [fen, result, turn, userColor, level, apply, paused, clock, sans, startFen]);

  // ── the coach looks at each position when it's your turn: what does the opponent threaten? ──
  useEffect(() => {
    if (!coach || result || turn !== userColor) return;
    let live = true;
    evaluate(fen); // start searching now, so grading your move is quick
    if (sans.length > 0)
      coachThreat(fen).then((t) => {
        if (live && t) say({ kind: 'threat', text: t.text });
      });
    return () => {
      live = false;
    };
  }, [coach, fen, result, turn, userColor, sans.length, say]);

  const onMove = (from: Square, to: Square, promotion: Promotion = 'q') => {
    if (result || turn !== userColor || thinking || paused) return false;
    const r = apply({ from, to, promotion });
    if (!r) return false;
    if (coach && !r.over) {
      setChecking(true);
      const uci = r.m.from + r.m.to + (r.m.promotion ?? '');
      const plies = r.s.length;
      grade(r.before, uci).then((g) => {
        if (fensLen.current !== plies + 1) return; // taken back meanwhile
        setChecking(false);
        setGrades((gs) => [...gs, g.classification]);
        setBadge({ square: r.m.to, c: g.classification });
        if (g.warn) {
          playSound('wrong');
          setWarning(g);
          if (isBot(level)) say({ kind: 'bot', text: level.onBlunder });
        } else say({ kind: 'grade', text: g.text, c: g.classification });
      });
    } else setGrades((gs) => [...gs, null]);
    return true;
  };

  function takeback() {
    ctrl.current?.abort();
    setWarning(null);
    setChecking(false);
    setBadge(null);
    takebacks.current++;
    // undo back to your last turn
    let n = fens.length - 1;
    if (n === 0) return;
    n -= 1;
    if ((fens[n].split(' ')[1] as 'w' | 'b') !== userColor && n > 0) n -= 1;
    setFens(fens.slice(0, n + 1));
    setSans(sans.slice(0, n));
    setGrades((g) => g.slice(0, n));
    setLastMove(null);
    setMessage('Move taken back.');
  }

  function playOn(g: Grade) {
    setWarning(null);
    say({ kind: 'grade', text: g.text, c: g.classification });
  }

  async function askHint() {
    const step = hintStep + 1;
    setHintStep(step);
    if (!coach) {
      const m = await hintMove(fen);
      setArrow(m);
      return;
    }
    const h = await coachHint(fen);
    if (step === 1) say({ kind: 'hint', text: `💡 ${h.idea}` });
    else if (step === 2 && h.from) {
      setHintSquare(h.from);
      say({ kind: 'hint', text: `💡 Look at the piece on ${h.from}.` });
    } else if (h.uci) {
      setArrow(h.uci);
      setHintSquare(null);
    }
  }

  const squares = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (lastMove) {
      out[lastMove[0]] = 'rgba(255,255,51,0.45)';
      out[lastMove[1]] = 'rgba(255,255,51,0.45)';
    }
    if (hintSquare) out[hintSquare] = 'rgba(76,158,255,0.6)';
    return out;
  }, [lastMove, hintSquare]);
  const arrows = useMemo(() => (arrow ? [[arrow, 'rgba(88,195,92,0.9)'] as [string, string]] : []), [arrow]);
  const inCheck = new Chess(fen).inCheck();
  const botColor = userColor === 'w' ? 'b' : 'w';
  const bot = isBot(level) ? level : null;
  const lastBotLine = [...feed].reverse().find((m) => m.kind === 'bot');
  const feedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [feed]);
  const hintLabel = !coach ? '💡 Hint' : hintStep === 0 ? '💡 Hint' : hintStep === 1 ? '💡 Which piece?' : '💡 Show move';

  return (
    <div className="puzzle-play with-bars" ref={fitRef}>
      <div className="puzzle-board">
        {/* player bars like chess.com: the computer above the board, you below, with what each has captured */}
        <div className="player-bar play-bar" data-side="bot">
          <span className={`avatar bot-avatar tone-${bot?.tone ?? 'grey'}`}>{bot?.avatar ?? '🤖'}</span>
          <span className="player-name">{level.name}</span>
          <span className="player-rating muted small">{bot ? `(${bot.rating})` : 'computer'}</span>
          <Captured fen={fen} side={botColor} />
          {thinking && !result && <span className="thinking" aria-label="thinking"><i /><i /><i /></span>}
          {clock && <span className={`clock ${botColor === 'w' ? 'white' : 'black'} ${turn === botColor && !result && sans.length ? 'active' : ''} ${clocks[botColor] < 20000 ? 'low' : ''}`}>{fmt(clocks[botColor])}</span>}
        </div>
        <div className="play-board-wrap">
          <Board id="play-board" fen={fen} orientation={userColor === 'w' ? 'white' : 'black'} onMove={result ? undefined : onMove} squares={squares} arrows={arrows} badge={badge ?? undefined} maxWidth={600} />
          {bot && lastBotLine && !result && (
            <div className="bot-speech" key={lastBotLine.id}>{lastBotLine.text}</div>
          )}
          {warning && (
            <div className="coach-warning" role="alertdialog" aria-label="Blunder warning">
              <div className="cw-head"><ClassIcon c="blunder" size={26} /> <b>Wait! Are you sure?</b></div>
              <p>{warning.warn}</p>
              <div className="row">
                <button className="btn-green" onClick={takeback}>↶ Take it back</button>
                <button className="btn-secondary" onClick={() => playOn(warning)}>Play on</button>
              </div>
            </div>
          )}
        </div>
        <div className="player-bar play-bar" data-side="you">
          <span className={`avatar ${userColor === 'w' ? 'white' : 'black'}`}>{(getMe() || 'You')[0].toUpperCase()}</span>
          <span className="player-name">You</span>
          <Captured fen={fen} side={userColor} />
          {clock && <span className={`clock ${userColor === 'w' ? 'white' : 'black'} ${turn === userColor && !result && sans.length ? 'active' : ''} ${clocks[userColor] < 20000 ? 'low' : ''}`}>{fmt(clocks[userColor])}</span>}
        </div>
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
                <b>{checking ? 'Coach is checking your move…' : warning ? 'Careful: take it back or play on' : turn === userColor ? (inCheck ? 'Check! Your move' : 'Your move') : `${level.name} is thinking…`}</b>
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
            <button className="btn-secondary" disabled={turn !== userColor || thinking || paused} onClick={askHint}>{hintLabel}</button>
            <button className="btn-secondary" onClick={takeback} disabled={sans.length === 0}>↶ Take back</button>
            <button className="btn-secondary" onClick={() => { playSound('end'); finish({ outcome: 'loss', success: goal ? false : undefined, reason: 'You resigned.' }, sans, fens); }}>Resign</button>
          </div>
        )}
        {coach && (
          <div className="coach-feed" ref={feedRef} aria-live="polite">
            {feed.filter((m) => m.kind !== 'bot').length === 0 && (
              <div className="coach-msg info">
                <span className="coach-avatar sm">♞</span>
                <div>I’m your coach for this game. I’ll grade your moves, warn you about threats and stop you before a blunder. Ask for a hint any time.</div>
              </div>
            )}
            {feed.filter((m) => m.kind !== 'bot').map((m) => (
              <div key={m.id} className={`coach-msg ${m.kind}`} style={m.c ? { ['--c' as string]: CLASS_META[m.c].color } : undefined}>
                {m.c ? <ClassIcon c={m.c} size={22} /> : <span className="coach-avatar sm">{m.kind === 'threat' ? '⚠️' : '♞'}</span>}
                <div>{m.text}</div>
              </div>
            ))}
          </div>
        )}
        <div className="book play-moves">
          {sans.map((san, i) => {
            const startBlack = startFen.split(' ')[1] === 'b';
            const ply = i + (startBlack ? 1 : 0);
            const no = Number(startFen.split(' ')[5] ?? 1) + Math.floor(ply / 2);
            const g = grades[i];
            return (
              <span key={i}>
                {ply % 2 === 0 && <span className="muted">{no}. </span>}
                {i === 0 && startBlack && <span className="muted">{no}… </span>}
                <span className="move inline" style={g && g !== 'best' && g !== 'excellent' && g !== 'good' ? { color: CLASS_META[g].color } : undefined}>{san}</span>{' '}
              </span>
            );
          })}
        </div>
        {children}
      </div>
    </div>
  );
}
