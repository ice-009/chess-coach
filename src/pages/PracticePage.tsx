import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { LEVELS } from '../lib/bot';
import type { Level } from '../lib/bot';
import { DRILLS, findDrill } from '../data/drills';
import { logActivity } from '../lib/activity';
import { KEYS, load, save } from '../lib/storage';
import { navigate } from '../lib/router';
import { PlayBoard } from '../components/PlayBoard';
import type { PlayResult } from '../components/PlayBoard';
import { AnalysisView } from '../components/AnalysisView';
import type { ParsedGame } from '../lib/analysis';
import { Board } from '../components/Board';

const START = new Chess().fen();

function toParsed(r: PlayResult): ParsedGame {
  const moves: ParsedGame['moves'] = [];
  r.sans.forEach((san, i) => {
    const m = new Chess(r.fens[i]).move(san);
    moves.push({ san: m.san, uci: m.from + m.to + (m.promotion ?? ''), from: m.from, to: m.to, color: m.color, captured: !!m.captured });
  });
  return { fens: r.fens, moves };
}

// ── Play the computer ──
function PlayComputer({ initialFen, initialColor }: { initialFen?: string; initialColor?: 'w' | 'b' }) {
  const [level, setLevel] = useState<Level>(() => LEVELS[load('cca-bot-level', 2)] ?? LEVELS[2]);
  // practising a position from a review: play the side whose move it is
  const [color, setColor] = useState<'w' | 'b' | 'random'>(() => initialColor ?? (initialFen ? (initialFen.split(' ')[1] as 'w' | 'b') : 'w'));
  const [game, setGame] = useState<{ key: number; fen: string; you: 'w' | 'b' } | null>(null);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [review, setReview] = useState(false);

  function start(fen = initialFen ?? START) {
    const you = color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color;
    save('cca-bot-level', level.id - 1);
    setResult(null);
    setReview(false);
    setGame({ key: Date.now(), fen, you });
  }

  if (game && result && review)
    return (
      <AnalysisView
        cacheKey={`bot:${game.key}`}
        parsed={toParsed(result)}
        white={{ name: game.you === 'w' ? 'You' : `Computer (${level.name})` }}
        black={{ name: game.you === 'b' ? 'You' : `Computer (${level.name})` }}
        perspective={game.you}
        result={result.outcome}
        onBack={() => setReview(false)}
        backLabel="← Back to the game"
      />
    );

  if (!game)
    return (
      <div className="play-setup">
        <div className="section-title">Opponent strength</div>
        <div className="level-grid">
          {LEVELS.slice(0, 7).map((l) => (
            <button key={l.id} className={`level-card ${level.id === l.id ? 'on' : ''}`} onClick={() => setLevel(l)}>
              <b>{l.id}. {l.name}</b>
              <span className="muted small">{l.note}</span>
            </button>
          ))}
        </div>
        <div className="section-title">You play</div>
        <div className="seg">
          {(['w', 'random', 'b'] as const).map((c) => (
            <button key={c} className={color === c ? 'on' : ''} onClick={() => setColor(c)}>{c === 'w' ? 'White' : c === 'b' ? 'Black' : 'Random'}</button>
          ))}
        </div>
        {initialFen && initialFen !== START && <p className="muted small">Starting from the position you sent from the analysis board.</p>}
        <div>
          <button className="btn-green big" onClick={() => start()}>Play</button>
        </div>
        <p className="muted small">Tip: play the openings from your repertoire, then review the game. Losing to a slightly stronger level teaches the most.</p>
      </div>
    );

  return (
    <PlayBoard
      key={game.key}
      startFen={game.fen}
      userColor={game.you}
      level={level}
      onFinish={(r) => {
        setResult(r);
        logActivity('game');
      }}
    >
      <div className="muted small">Opponent: {level.name}</div>
      {result && (
        <div className="row">
          <button className="btn-green" onClick={() => setReview(true)}>Review this game</button>
          <button className="btn-secondary" onClick={() => start(game.fen)}>Rematch</button>
          <button className="btn-secondary" onClick={() => setGame(null)}>New game</button>
        </div>
      )}
    </PlayBoard>
  );
}

// ── Endgame drills ──
function DrillList() {
  const done = load<Record<string, number>>(KEYS.drillsDone, {});
  const groups = [...new Set(DRILLS.map((d) => d.group))];
  return (
    <div>
      <p className="muted">Endgames you must know to reach 1500. Win the winning ones against best defence and hold the draws. Each drill is checked by Stockfish.</p>
      {groups.map((g) => (
        <section key={g} className="chapter">
          <h2>{g}</h2>
          <div className="cards">
            {DRILLS.filter((d) => d.group === g).map((d) => (
              <button key={d.id} className={`card ${done[d.id] ? 'done-card' : ''}`} onClick={() => navigate(`practice/drill/${d.id}`)}>
                <div className="card-title">{done[d.id] ? '✓ ' : ''}{d.title}</div>
                <div className="muted small">
                  {d.goal.type === 'mate' ? `Checkmate in ${d.goal.maxMoves} moves` : d.goal.type === 'promote' ? `Promote within ${d.goal.maxMoves} moves` : `Hold the draw ${d.goal.surviveMoves} moves`} · you play {d.you === 'w' ? 'White' : 'Black'}
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function DrillView({ id }: { id: string }) {
  const drill = findDrill(id);
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<PlayResult | null>(null);
  if (!drill) return <div className="error">Drill not found.</div>;
  const idx = DRILLS.indexOf(drill);
  const next = DRILLS[idx + 1];
  return (
    <div>
      <button className="btn-ghost" onClick={() => navigate('practice/drills')}>← All drills</button>
      <h2>{drill.title}</h2>
      <PlayBoard
        key={attempt}
        startFen={drill.fen}
        userColor={drill.you}
        level={LEVELS[7]}
        goal={drill.goal}
        onFinish={(r) => {
          setOutcome(r);
          logActivity('drill');
          if (r.success) {
            const done = load<Record<string, number>>(KEYS.drillsDone, {});
            save(KEYS.drillsDone, { ...done, [drill.id]: (done[drill.id] ?? 0) + 1 });
          }
        }}
      >
        <div className="note">💡 {drill.tip}</div>
        {outcome && (
          <div className="row">
            <button className="btn-secondary" onClick={() => { setOutcome(null); setAttempt((a) => a + 1); }}>↺ Try again</button>
            {next && <button className="btn-green" onClick={() => navigate(`practice/drill/${next.id}`)}>Next drill →</button>}
          </div>
        )}
      </PlayBoard>
    </div>
  );
}

// ── Board vision: name → square, against the clock ──
const FILES = 'abcdefgh';
const randomSquare = () => `${FILES[Math.floor(Math.random() * 8)]}${1 + Math.floor(Math.random() * 8)}`;
const EMPTY = '8/8/8/8/8/8/8/8 w - - 0 1';
const VISION_SECONDS = 30;

function Vision() {
  const [side, setSide] = useState<'white' | 'black'>('white');
  const [phase, setPhase] = useState<'ready' | 'running' | 'over'>('ready');
  const [target, setTarget] = useState(randomSquare);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [left, setLeft] = useState(VISION_SECONDS);
  const [flash, setFlash] = useState<{ sq: string; ok: boolean } | null>(null);
  const [best, setBest] = useState(() => load<Record<string, number>>(KEYS.visionBest, {}));
  const startedAt = useRef(0);
  const recorded = useRef(false); // each run is recorded once

  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => {
      const rem = Math.max(0, VISION_SECONDS - (Date.now() - startedAt.current) / 1000);
      setLeft(rem);
      if (rem <= 0) setPhase('over');
    }, 100);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'over' || recorded.current) return;
    recorded.current = true;
    logActivity('vision');
    if (score > (best[side] ?? 0)) {
      const next = { ...best, [side]: score };
      save(KEYS.visionBest, next);
      setBest(next);
    }
  }, [phase, score, best, side]);

  const onSquare = (sq: Square) => {
    if (phase !== 'running') return;
    const ok = sq === target;
    setFlash({ sq, ok });
    if (ok) {
      setScore((s) => s + 1);
      let n = randomSquare();
      while (n === target) n = randomSquare();
      setTarget(n);
    } else setMisses((m) => m + 1);
  };
  const squares = useMemo(() => (flash ? { [flash.sq]: flash.ok ? 'rgba(129,182,76,0.75)' : 'rgba(250,65,45,0.6)' } : {}), [flash]);

  return (
    <div className="puzzle-play">
      <div className="puzzle-board vision-board">
        <Board id="vision-board" fen={EMPTY} orientation={side} onSquare={onSquare} squares={squares} hideCoords maxWidth={560} />
        {phase === 'running' && <div className="vision-target">{target}</div>}
      </div>
      <div className="puzzle-side panel">
        <h3>Board vision</h3>
        <p className="muted">Click the named square as fast as you can. Strong players “see” coordinates without thinking: it makes calculation and notation effortless.</p>
        <div className="seg">
          {(['white', 'black'] as const).map((s) => (
            <button key={s} className={side === s ? 'on' : ''} disabled={phase === 'running'} onClick={() => setSide(s)}>As {s === 'white' ? 'White' : 'Black'}</button>
          ))}
        </div>
        {phase === 'running' ? (
          <div className="rush-bar">
            <span className={`rush-time ${left < 5 ? 'low' : ''}`}>{left.toFixed(1)}s</span>
            <span className="rush-points">✓ {score}</span>
            <span className="muted">✕ {misses}</span>
          </div>
        ) : (
          <>
            {phase === 'over' && (
              <div className="rating-panel">
                <div className="muted small">Score</div>
                <div className="big-rating">{score}</div>
                <div className="muted small">{misses} misses · best as {side}: {best[side] ?? score}</div>
              </div>
            )}
            <button
              className="btn-green big"
              onClick={() => {
                setScore(0);
                setMisses(0);
                setFlash(null);
                setTarget(randomSquare());
                setLeft(VISION_SECONDS);
                startedAt.current = Date.now();
                recorded.current = false;
                setPhase('running');
              }}
            >
              {phase === 'over' ? 'Again' : `Start (${VISION_SECONDS} seconds)`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const TABS = [
  { id: '', label: 'Play the computer' },
  { id: 'drills', label: 'Endgame drills' },
  { id: 'vision', label: 'Board vision' },
];

export function PracticePage({ sub, arg, fen, color }: { sub?: string; arg?: string; fen?: string; color?: string }) {
  const active = sub === 'drill' ? 'drills' : (sub ?? '');
  return (
    <div>
      <div className="page-head">
        <h1>Practice</h1>
        <p className="muted">Play, drill the endgames that decide games, and sharpen your board vision.</p>
      </div>
      <div className="seg">
        {TABS.map((t) => (
          <button key={t.id} className={active === t.id ? 'on' : ''} onClick={() => navigate(`practice${t.id ? `/${t.id}` : ''}`)}>{t.label}</button>
        ))}
      </div>
      {!sub && <PlayComputer initialFen={fen} initialColor={color === 'w' || color === 'b' ? color : undefined} />}
      {sub === 'drills' && <DrillList />}
      {sub === 'drill' && arg && <DrillView key={arg} id={arg} />}
      {sub === 'vision' && <Vision />}
    </div>
  );
}
