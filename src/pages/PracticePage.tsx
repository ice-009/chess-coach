import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { BOTS, LEVELS, STYLE_LABEL, findBot, lockedBy } from '../lib/bot';
import type { Bot } from '../lib/bot';
import { botGames, botRecords, findBotGame, parsedBotGame, saveBotGame } from '../lib/botGames';
import { CLASS_META } from '../lib/classMeta';
import { ClassIcon } from '../components/icons';
import { DRILLS, findDrill } from '../data/drills';
import { logActivity } from '../lib/activity';
import { KEYS, load, save } from '../lib/storage';
import { navigate } from '../lib/router';
import { PlayBoard } from '../components/PlayBoard';
import type { PlayResult, TimeControl } from '../components/PlayBoard';
import { AnalysisView } from '../components/AnalysisView';
import type { ParsedGame } from '../lib/analysis';
import { Board } from '../components/Board';
import { useFitTop } from '../lib/useFitTop';

const START = new Chess().fen();

function toParsed(r: PlayResult): ParsedGame {
  const moves: ParsedGame['moves'] = [];
  r.sans.forEach((san, i) => {
    const m = new Chess(r.fens[i]).move(san);
    moves.push({ san: m.san, uci: m.from + m.to + (m.promotion ?? ''), from: m.from, to: m.to, color: m.color, captured: !!m.captured });
  });
  return { fens: r.fens, moves };
}

// ── Play the computer: a ladder of bots with personalities, an optional clock and the live coach ──
const TIME_CONTROLS: { id: string; label: string; tc: TimeControl | null }[] = [
  { id: 'none', label: 'No clock', tc: null },
  { id: '3+2', label: '3 | 2', tc: { base: 180, inc: 2 } },
  { id: '5+3', label: '5 | 3', tc: { base: 300, inc: 3 } },
  { id: '10+0', label: '10 min', tc: { base: 600, inc: 0 } },
  { id: '15+10', label: '15 | 10', tc: { base: 900, inc: 10 } },
];

function BotAvatar({ bot, size = 'md' }: { bot: Bot; size?: 'sm' | 'md' | 'lg' }) {
  return <span className={`bot-face ${size} tone-${bot.tone}`} aria-hidden="true">{bot.avatar}</span>;
}

function PlayComputer({ initialFen, initialColor, initialBot }: { initialFen?: string; initialColor?: 'w' | 'b'; initialBot?: string }) {
  const [unlockAll, setUnlockAll] = useState(() => load(KEYS.botUnlockAll, false));
  // a deep link opens its bot even if it's locked; otherwise the last bot you played, if it's open, or the strongest open one
  const [bot, setBot] = useState<Bot>(() => {
    const recs = botRecords();
    const open = (b?: Bot) => (b && !lockedBy(b.slug, recs, unlockAll) ? b : undefined);
    return findBot(initialBot ?? '') ?? open(findBot(load('cca-bot', 'riya'))) ?? [...BOTS].reverse().find((b) => open(b))!;
  });
  // practising a position from a review: play the side whose move it is
  const [color, setColor] = useState<'w' | 'b' | 'random'>(() => initialColor ?? (initialFen ? (initialFen.split(' ')[1] as 'w' | 'b') : 'w'));
  const [tcId, setTcId] = useState(() => load('cca-bot-tc', 'none'));
  const [coach, setCoach] = useState(() => load('cca-bot-coach', true));
  const [game, setGame] = useState<{ key: number; fen: string; you: 'w' | 'b' } | null>(null);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [review, setReview] = useState(false);
  const records = botRecords();
  const recent = botGames().slice(0, 8);
  const tc = TIME_CONTROLS.find((t) => t.id === tcId) ?? TIME_CONTROLS[0];
  // the next bot to beat: the weakest one you haven't beaten yet
  const nextUp = BOTS.find((b) => !(records[b.slug]?.w > 0));
  const lockOf = (b: Bot) => lockedBy(b.slug, records, unlockAll);
  const lock = bot.slug === initialBot ? null : lockOf(bot);
  // the bot to play to get there: down the ladder to the first open one
  let climb = lock;
  for (let below = climb && lockOf(climb); below; below = lockOf(below)) climb = below;
  const toggleUnlock = (on: boolean) => {
    setUnlockAll(on);
    save(KEYS.botUnlockAll, on);
  };

  function start(fen = initialFen ?? START) {
    const you = color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color;
    save('cca-bot', bot.slug);
    save('cca-bot-tc', tcId);
    save('cca-bot-coach', coach);
    setResult(null);
    setReview(false);
    setGame({ key: Date.now(), fen, you });
  }

  if (game && result && review)
    return (
      <AnalysisView
        cacheKey={`bot:${game.key}`}
        parsed={toParsed(result)}
        white={{ name: game.you === 'w' ? 'You' : `${bot.name} (${bot.rating})` }}
        black={{ name: game.you === 'b' ? 'You' : `${bot.name} (${bot.rating})` }}
        perspective={game.you}
        result={result.outcome}
        onBack={() => setReview(false)}
        backLabel="← Back to the game"
      />
    );

  if (!game)
    return (
      <div className="bot-setup">
        <div className="bot-gallery">
          <div className="section-title">Choose your opponent</div>
          <div className="bot-grid">
            {BOTS.map((b) => {
              const r = records[b.slug];
              const by = lockOf(b);
              return (
                <button key={b.slug} className={`bot-card tone-${b.tone} ${bot.slug === b.slug ? 'on' : ''} ${by ? 'locked' : ''}`} onClick={() => setBot(b)} data-bot={b.slug} aria-label={by ? `${b.name}, locked: beat ${by.name} to unlock` : undefined}>
                  <BotAvatar bot={b} />
                  <span className="bot-card-main">
                    <b>{b.name}</b>
                    <span className="bot-rating">{b.rating}</span>
                  </span>
                  <span className="bot-style">{by ? `Beat ${by.name} to unlock` : STYLE_LABEL[b.style]}</span>
                  {by ? (
                    <span className="bot-record locked" aria-hidden="true">🔒</span>
                  ) : r && (r.w || r.d || r.l) ? (
                    <span className={`bot-record ${r.w ? 'beaten' : ''}`}>{r.w ? '✓ ' : ''}{r.w}–{r.d}–{r.l}</span>
                  ) : nextUp?.slug === b.slug ? (
                    <span className="bot-record next">Next</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <label className="switch-row bot-unlock">
            <span>
              <b>Unlock all bots</b>
              <span className="muted small">Each bot opens when you beat or draw the one below it. Skip the climb if you’re already strong.</span>
            </span>
            <input type="checkbox" className="switch" checked={unlockAll} onChange={(e) => toggleUnlock(e.target.checked)} />
          </label>
          {recent.length > 0 && (
            <>
              <div className="section-title">Your recent games</div>
              <ul className="recent bot-recent">
                {recent.map((g) => {
                  const b = findBot(g.bot);
                  return (
                    <li key={g.id}>
                      <a href={`#/practice/game/${g.id}`}>
                        <span className={`result ${g.outcome}`}>{g.outcome === 'win' ? 'W' : g.outcome === 'loss' ? 'L' : '½'}</span>
                        <span className="recent-main">
                          <b>{b ? `${b.avatar} ${b.name}` : g.bot} <span className="muted">({b?.rating ?? '?'})</span></b>
                          <span className="muted small">{g.reason} · {Math.ceil(g.sans.length / 2)} moves{g.tc ? ` · ${g.tc}` : ''}{g.coach ? ' · with coach' : ''}</span>
                        </span>
                        <span className="review-cta">Review →</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
        <aside className={`bot-hero panel tone-${bot.tone}`}>
          <div className="bot-hero-top">
            <BotAvatar bot={bot} size="lg" />
            <div>
              <div className="bot-hero-name">{bot.name}</div>
              <div className="row bot-hero-tags">
                <span className="bot-rating">{bot.rating}</span>
                <span className="bot-style">{STYLE_LABEL[bot.style]}</span>
              </div>
            </div>
          </div>
          <div className="speech">{bot.greet}</div>
          <p className="muted small bot-bio">{bot.bio}</p>
          <div className="opt">
            <div className="opt-label">You play</div>
            <div className="seg">
              {(['w', 'random', 'b'] as const).map((c) => (
                <button key={c} className={color === c ? 'on' : ''} onClick={() => setColor(c)}>{c === 'w' ? '♔ White' : c === 'b' ? '♚ Black' : '🎲 Random'}</button>
              ))}
            </div>
          </div>
          <div className="opt">
            <div className="opt-label">Time control</div>
            <div className="chips">
              {TIME_CONTROLS.map((t) => (
                <button key={t.id} className={`chip ${tcId === t.id ? 'on' : ''}`} onClick={() => setTcId(t.id)}>{t.label}</button>
              ))}
            </div>
          </div>
          <label className="switch-row">
            <span>
              <b>Play with the coach</b>
              <span className="muted small">Grades every move, warns about threats and lets you take back a blunder before {bot.name} answers.</span>
            </span>
            <input type="checkbox" className="switch" checked={coach} onChange={(e) => setCoach(e.target.checked)} />
          </label>
          {initialFen && initialFen !== START && <p className="muted small">Starting from the position you sent from the analysis board.</p>}
          {lock ? (
            <>
              <p className="bot-lock-note">🔒 Beat or draw {lock.name} to unlock {bot.name}.</p>
              <button className="btn-green big" onClick={() => setBot(climb ?? lock)}>Go to {(climb ?? lock).name}</button>
            </>
          ) : (
            <button className="btn-green big" onClick={() => start()}>Play {bot.name}</button>
          )}
        </aside>
      </div>
    );

  const counts = (result?.grades ?? []).reduce<Record<string, number>>((acc, g) => (g ? { ...acc, [g]: (acc[g] ?? 0) + 1 } : acc), {});
  return (
    <PlayBoard
      key={game.key}
      startFen={game.fen}
      userColor={game.you}
      level={bot}
      coach={coach}
      clock={tc.tc}
      onFinish={(r) => {
        setResult(r);
        logActivity('game');
        saveBotGame({
          id: String(game.key), bot: bot.slug, you: game.you, startFen: game.fen, sans: r.sans, outcome: r.outcome, reason: r.reason,
          date: Date.now(), tc: tc.tc ? tc.id : null, coach, grades: r.grades, takebacks: r.takebacks,
        });
      }}
    >
      {result && (
        <div className="game-over">
          {coach && Object.keys(counts).length > 0 && (
            <div className="grade-strip">
              {(['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'] as const).filter((c) => counts[c]).map((c) => (
                <span key={c} className="grade-pill" style={{ ['--c' as string]: CLASS_META[c].color }}><ClassIcon c={c} size={18} /> {counts[c]} {CLASS_META[c].label}</span>
              ))}
              {(result.takebacks ?? 0) > 0 && <span className="grade-pill">↶ {result.takebacks} take-back{result.takebacks === 1 ? '' : 's'}</span>}
            </div>
          )}
          <div className="row">
            <button className="btn-green" onClick={() => setReview(true)}>Review this game</button>
            <button className="btn-secondary" onClick={() => start(game.fen)}>Rematch</button>
            <button className="btn-secondary" onClick={() => setGame(null)}>New opponent</button>
          </div>
        </div>
      )}
    </PlayBoard>
  );
}

/** A saved bot game, opened from "Your recent games". */
function BotGameReview({ id }: { id: string }) {
  const g = findBotGame(id);
  if (!g) return <div className="empty">This game isn’t saved on this device any more.</div>;
  const b = findBot(g.bot);
  const name = b ? `${b.name} (${b.rating})` : 'Computer';
  return (
    <AnalysisView
      cacheKey={`bot:${g.id}`}
      parsed={parsedBotGame(g)}
      white={{ name: g.you === 'w' ? 'You' : name }}
      black={{ name: g.you === 'b' ? 'You' : name }}
      perspective={g.you}
      result={g.outcome}
      onBack={() => navigate('practice')}
      backLabel="← Play"
    />
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
  const fitRef = useFitTop<HTMLDivElement>();
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
    <div className="puzzle-play" ref={fitRef}>
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
  { id: '', label: 'Play a bot' },
  { id: 'drills', label: 'Endgame drills' },
  { id: 'vision', label: 'Board vision' },
];

export function PracticePage({ sub, arg, fen, color, bot }: { sub?: string; arg?: string; fen?: string; color?: string; bot?: string }) {
  const active = sub === 'drill' ? 'drills' : (sub ?? '');
  return (
    <div>
      <div className="page-head hide-intro-sm">
        <h1>Play</h1>
        <p className="muted">Ten bots from 400 up to Stockfish itself, each with its own style. Beat one to unlock the next. Turn on the coach and it warns you before a blunder counts.</p>
      </div>
      <div className="seg scroll-sm">
        {TABS.map((t) => (
          <button key={t.id} className={active === t.id ? 'on' : ''} onClick={() => navigate(`practice${t.id ? `/${t.id}` : ''}`)}>{t.label}</button>
        ))}
      </div>
      {!sub && <PlayComputer initialFen={fen} initialColor={color === 'w' || color === 'b' ? color : undefined} initialBot={bot} />}
      {sub === 'drills' && <DrillList />}
      {sub === 'drill' && arg && <DrillView key={arg} id={arg} />}
      {sub === 'vision' && <Vision />}
      {sub === 'game' && arg && <BotGameReview key={arg} id={arg} />}
    </div>
  );
}
