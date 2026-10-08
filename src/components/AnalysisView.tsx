import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { DEEP_DEPTH, analyzeGame, estimateGameRating, formatClock, isError, loadCached, saveCached, timeSpent, winPct } from '../lib/analysis';
import type { AnalysisStage, Classification, GameAnalysis, ParsedGame, PositionEval } from '../lib/analysis';
import { CLASS_META, CLASS_ORDER } from '../lib/classMeta';
import { coachFacts, coachReport, explainMove } from '../lib/coach';
import { formatScore } from '../lib/chess';
import { getEngine } from '../lib/engine';
import { THEME_LABEL, explainChoice } from '../lib/moveReasons';
import { TYPE_LABEL, keyMoments } from '../lib/keyMoments';
import type { KeyMoment } from '../lib/keyMoments';
import { recordQuickReview } from '../lib/quickReviews';
import type { MoveWhy, Reason } from '../lib/moveReasons';
import { navigate } from '../lib/router';
import { Board } from './Board';
import { Captured } from './Captured';
import type { Promotion } from './Board';
import { ClassIcon } from './icons';
import { EvalBar } from './EvalBar';
import { AGAIN, GOOD, addCard } from '../lib/deck';
import { CoachPanel } from './CoachPanel';

export interface PlayerInfo {
  name: string;
  rating?: number;
}

interface Props {
  cacheKey: string;
  parsed: ParsedGame;
  white: PlayerInfo;
  black: PlayerInfo;
  perspective: 'w' | 'b'; // whose mistakes the coach explains, and board orientation
  result?: 'win' | 'loss' | 'draw'; // from the perspective player's side
  meta?: { opening?: string; timeControl?: string };
  comments?: (string | undefined)[]; // per ply (index 1 = after the first move)
  heading?: string;
  onBack: () => void;
  backLabel?: string;
  onAnalyzed?: (a: GameAnalysis) => void;
  initialPly?: number; // open at this move
  showCoach?: boolean; // the coach explains *your* mistakes; off for other people's games
  extraAction?: { label: string; onClick: (ply: number) => void };
}

type Tab = 'quick' | 'report' | 'moves' | 'coach';

const NO_ARROWS: string[] = [];
const NO_SQUARES: Record<string, string> = {};
const evalText = (ev?: PositionEval) => (ev ? formatScore(ev.mate === null ? ev.cp : null, ev.mate) : '');

function whitePctOf(ev?: PositionEval): number | null {
  if (!ev) return null;
  if (ev.mate !== null) return ev.cp > 0 ? 100 : 0;
  return winPct(ev.cp);
}

const EvalGraph = memo(function EvalGraph({ evals, reviews, ply, onSelect }: { evals: PositionEval[]; reviews: GameAnalysis['reviews']; ply: number; onSelect: (i: number) => void }) {
  const W = 600;
  const H = 90;
  const pts = useMemo(
    () => evals.map((e, i) => [(i / Math.max(1, evals.length - 1)) * W, H - (Math.min(97, Math.max(3, winPct(e.cp))) / 100) * H]),
    [evals],
  );
  const d = useMemo(() => `M0,${H} ${pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} L${W},${H} Z`, [pts]);
  return (
    <svg
      className="eval-graph"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onSelect(Math.round(((e.clientX - r.left) / r.width) * (evals.length - 1)));
      }}
    >
      <rect width={W} height={H} fill="#403e3b" />
      <path d={d} fill="#ffffff" />
      <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="#8b8987" strokeWidth={1} />
      <line x1={pts[ply][0]} x2={pts[ply][0]} y1={0} y2={H} stroke="#81b64c" strokeWidth={2.5} />
      {reviews.map((r, i) =>
        isError(r.classification) || r.classification === 'brilliant' || r.classification === 'great' ? (
          <circle key={i} cx={pts[i + 1][0]} cy={pts[i + 1][1]} r={4.5} fill={CLASS_META[r.classification].color} stroke="#262421" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        ) : null,
      )}
    </svg>
  );
});

const MoveList = memo(function MoveList({
  parsed,
  reviews,
  comments,
  ply,
  onSelect,
}: {
  parsed: ParsedGame;
  reviews?: GameAnalysis['reviews'];
  comments?: (string | undefined)[];
  ply: number;
  onSelect: (p: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const spent = useMemo(() => timeSpent(parsed), [parsed]);

  // keep the active move visible without scrolling the whole page
  useEffect(() => {
    const box = ref.current;
    const el = box?.querySelector<HTMLElement>('.mv.active');
    if (!box || !el) return;
    const top = el.offsetTop; // .move-list is the offsetParent (position: relative)
    if (top < box.scrollTop || top + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top - box.clientHeight / 2;
  }, [ply]);

  const cell = (idx: number) => {
    const m = parsed.moves[idx];
    if (!m) return <span />;
    const c = reviews?.[idx]?.classification;
    return (
      <button className={`mv ${ply === idx + 1 ? 'active' : ''} ${comments?.[idx + 1] ? 'noted' : ''}`} onClick={() => onSelect(idx + 1)}>
        {c ? <ClassIcon c={c} size={15} /> : <span className="icon-slot" />}
        <span>{m.san}</span>
        {spent[idx] !== null && <span className="mv-time">{(spent[idx] as number) < 10 ? (spent[idx] as number).toFixed(1) : Math.round(spent[idx] as number)}s</span>}
      </button>
    );
  };

  const rows = [];
  for (let i = 0; i < parsed.moves.length; i += 2) {
    rows.push(
      <div className={`mv-row ${(i / 2) % 2 ? 'odd' : ''}`} key={i}>
        <span className="mv-no">{i / 2 + 1}.</span>
        {cell(i)}
        {cell(i + 1)}
      </div>,
    );
  }
  return (
    <div className="move-list" ref={ref}>
      {rows}
    </div>
  );
});

function Summary({
  analysis,
  parsed,
  white,
  black,
  verdict,
  onStart,
  onCoach,
  moments,
  onQuick,
  clockLine,
}: {
  analysis: GameAnalysis;
  parsed: ParsedGame;
  white: PlayerInfo;
  black: PlayerInfo;
  verdict?: string;
  onStart: () => void;
  onCoach: () => void;
  moments?: KeyMoment[] | null; // your key moments (your own games, once the deep analysis is done)
  onQuick?: () => void;
  clockLine?: { used: number; base: number; fast: number; moves: number } | null;
}) {
  const counts = useMemo(() => {
    const out: Record<'w' | 'b', Partial<Record<Classification, number>>> = { w: {}, b: {} };
    analysis.reviews.forEach((r, i) => {
      const side = parsed.moves[i].color;
      out[side][r.classification] = (out[side][r.classification] ?? 0) + 1;
    });
    return out;
  }, [analysis, parsed]);
  const rating = (c: 'w' | 'b', p: PlayerInfo) => {
    const played = analysis.reviews.filter((r, i) => parsed.moves[i].color === c && r.classification !== 'book').length;
    return estimateGameRating(analysis.acpl[c], played, p.rating);
  };

  return (
    <div className="summary">
      {verdict && (
        <button className="verdict-teaser" onClick={onCoach}>
          <span className="coach-avatar sm">♞</span>
          <span>{verdict}</span>
          <span className="teaser-more">Why? →</span>
        </button>
      )}
      <div className="acc-grid">
        <div className="acc-head" />
        <div className="acc-player">
          <span className="avatar sm white">{white.name[0]?.toUpperCase()}</span>
          <span className="ellipsis">{white.name}</span>
        </div>
        <div className="acc-player">
          <span className="avatar sm black">{black.name[0]?.toUpperCase()}</span>
          <span className="ellipsis">{black.name}</span>
        </div>
        <div className="acc-label">Accuracy</div>
        <div className="acc-box white">{analysis.accuracy.w.toFixed(1)}</div>
        <div className="acc-box black">{analysis.accuracy.b.toFixed(1)}</div>
        <div className="acc-label" title="Estimate: your rating, adjusted by how accurately you played compared with typical players at your rating.">
          Game Rating <span className="muted small">≈</span>
        </div>
        <div className="rating-box">{rating('w', white)}</div>
        <div className="rating-box">{rating('b', black)}</div>
      </div>
      <div className="class-table">
        {CLASS_ORDER.map((c) => (
          <div className="class-row" key={c}>
            <span className="class-count" style={{ color: CLASS_META[c].color }}>{counts.w[c] ?? 0}</span>
            <span className="class-name">
              <ClassIcon c={c} size={20} />
              {CLASS_META[c].label}
            </span>
            <span className="class-count" style={{ color: CLASS_META[c].color }}>{counts.b[c] ?? 0}</span>
          </div>
        ))}
      </div>
      {clockLine && (
        <div className={`clock-line ${clockLine.fast / clockLine.moves >= 0.2 || clockLine.used / clockLine.base < 0.6 ? 'warn' : ''}`}>
          ⏱ You used <b>{(clockLine.used / 60).toFixed(1)} of {Math.round(clockLine.base / 60)} min</b> · <b>{clockLine.fast} of {clockLine.moves}</b> moves in under 5 seconds
        </div>
      )}
      {moments && moments.length > 0 && onQuick ? (
        <>
          <button className="btn-green big quick-start" onClick={onQuick}>⚡ Quick review: {moments.length} key moment{moments.length > 1 ? 's' : ''}</button>
          <div className="muted small center">The moves that decided this game, as puzzles. About {moments.length * 2} minutes.</div>
          <button className="btn-secondary wide" onClick={onStart}>Full review (every move)</button>
        </>
      ) : (
        <>
          {moments && moments.length === 0 && <div className="note">🎉 No big mistakes in this game. Step through it to see your best moves.</div>}
          <button className="btn-green big" onClick={onStart}>Start Review</button>
        </>
      )}
    </div>
  );
}

/** A variation shown on the board instead of the game: Stockfish's line, from the position before a move. */
interface LineView {
  base: number; // index of the starting position in the game
  fens: string[];
  moves: { from: string; to: string; san: string }[];
  idx: number; // how many moves of the line are on the board
  title: string;
}

/** "Retry": find a better move yourself in the position before your mistake. */
interface RetryState {
  i: number; // index of the move being retried
  fen: string; // what the board shows
  status: 'try' | 'checking' | 'right' | 'alt' | 'wrong';
  tries: number;
  tried?: string; // SAN of the last attempt
}

const moverWin = (e: PositionEval, me: 'w' | 'b') => (me === 'w' ? winPct(e.cp) : 100 - winPct(e.cp));

function ReasonList({ reasons }: { reasons: Reason[] }) {
  return (
    <ul className="why-list">
      {reasons.map((r) => (
        <li key={r.theme}>
          {r.text}{' '}
          {r.lesson && (
            <a className="learn" href={`#/learn/${r.lesson}`}>
              {THEME_LABEL[r.theme]} →
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Under the coach's speech bubble: the best move and why it works, or why the move played was good. */
function WhyCard({
  why,
  classification,
  evalBest,
  evalPlayed,
  onLine,
  onRetry,
}: {
  why: { played: MoveWhy; best: MoveWhy | null; reply: string | null };
  classification: Classification;
  evalBest: string;
  evalPlayed: string;
  onLine: (pv: string[], title: string) => void;
  onRetry: () => void;
}) {
  const { played, best } = why;
  if (classification === 'book') return null;
  if (!best) {
    return (
      <div className="why-card good">
        <div className="why-head">
          <ClassIcon c={classification === 'great' || classification === 'brilliant' ? classification : 'best'} size={18} />
          Why {played.san} is {classification === 'great' || classification === 'brilliant' ? 'so strong' : 'the best move'}
        </div>
        {played.reasons.length ? <ReasonList reasons={played.reasons} /> : <div className="muted small">It is Stockfish’s first choice and keeps the position at {evalBest}.</div>}
        {played.pv.length > 1 && (
          <div className="why-actions">
            <button className="chip" onClick={() => onLine(played.pv, `What follows ${played.san}`)}>▶ Show the follow-up</button>
          </div>
        )}
      </div>
    );
  }
  const error = isError(classification) || classification === 'inaccuracy';
  return (
    <div className={`why-card ${error ? 'bad' : ''}`}>
      <div className="why-head">
        <ClassIcon c="best" size={18} />
        Best move: {best.san}
        <span className="eval-chip">{evalBest}</span>
      </div>
      {best.reasons.length ? (
        <ReasonList reasons={best.reasons} />
      ) : (
        <div className="muted small">
          No quick tactic: it is simply the most precise move. It keeps the position at {evalBest}; after {played.san}
          {why.reply ? `, your opponent’s best answer is ${why.reply}, and` : ''} the position is {evalPlayed}.
        </div>
      )}
      <div className="why-line">
        <span className="muted">Best line:</span> {best.line}
      </div>
      {!error && played.reasons.length > 0 && !['mate', 'material', 'fork'].includes(played.reasons[0].theme) && (
        <div className="why-also">
          Your move {played.san} is fine too: {played.reasons[0].text.charAt(0).toLowerCase() + played.reasons[0].text.slice(1)}
        </div>
      )}
      <div className="why-actions">
        <button className="chip" onClick={() => onLine(best.pv, `Best line instead of ${played.san}`)}>▶ Show the line</button>
        {error && <button className="chip" onClick={onRetry}>↻ Retry this move</button>}
      </div>
    </div>
  );
}

function LineCard({ line, onStep, onClose }: { line: LineView; onStep: (to: number) => void; onClose: () => void }) {
  const [, side, , , , full] = line.fens[0].split(' ');
  let no = Number(full);
  return (
    <div className="line-card">
      <div className="row-between">
        <b>{line.title}</b>
        <button className="chip" onClick={onClose}>✕ Back to the game</button>
      </div>
      <div className="line-moves">
        {line.moves.map((m, k) => {
          const white = (k + (side === 'b' ? 1 : 0)) % 2 === 0;
          const label = white ? `${no}.` : k === 0 ? `${no}…` : '';
          if (!white) no++;
          return (
            <span key={k}>
              {label && <span className="muted">{label} </span>}
              <button className={`move inline ${line.idx === k + 1 ? 'active' : ''}`} onClick={() => onStep(k + 1)}>{m.san}</button>{' '}
            </span>
          );
        })}
      </div>
      <div className="why-actions">
        <button className="chip" onClick={() => onStep(line.idx - 1)} disabled={line.idx === 0} aria-label="Previous move in the line">◀</button>
        <button className="chip" onClick={() => onStep(line.idx + 1)} disabled={line.idx >= line.moves.length} aria-label="Next move in the line">▶</button>
        <span className="muted small">Stockfish’s line, not the game. ◀ ▶ or the arrow keys step through it.</span>
      </div>
    </div>
  );
}

function RetryCard({
  retry,
  color,
  playedSan,
  best,
  onShow,
  onClose,
}: {
  retry: RetryState;
  color: 'w' | 'b';
  playedSan: string;
  best: MoveWhy | null;
  onShow: () => void;
  onClose: () => void;
}) {
  const side = color === 'w' ? 'White' : 'Black';
  return (
    <div className={`retry-card ${retry.status}`}>
      {retry.status === 'try' && (
        <div>
          <b>Find a better move for {side}.</b> In the game you played {playedSan}. Move a piece on the board.
        </div>
      )}
      {retry.status === 'checking' && (
        <div className="row">
          <span className="spinner tiny" /> Checking {retry.tried}…
        </div>
      )}
      {retry.status === 'wrong' && (
        <div>
          <b>✗ {retry.tried} isn’t better.</b> {retry.tried === playedSan ? 'That is the move from the game. ' : ''}Look for checks, captures and threats, then try again.
        </div>
      )}
      {retry.status === 'right' && (
        <>
          <div>
            <b>✓ {retry.tried} is the best move!</b>
          </div>
          {best && best.reasons.length > 0 && <ReasonList reasons={best.reasons} />}
        </>
      )}
      {retry.status === 'alt' && (
        <div>
          <b>✓ {retry.tried} works too.</b> Stockfish’s first choice was {best?.san}.
        </div>
      )}
      <div className="why-actions">
        {(retry.status === 'right' || retry.status === 'alt' || retry.tries >= 2) && (
          <button className="chip" onClick={onShow}>{retry.status === 'wrong' ? 'Show the answer' : '▶ Show the line'}</button>
        )}
        <button className="chip" onClick={onClose}>Back to the game</button>
      </div>
    </div>
  );
}

const moveLabel = (ply: number, san: string) => `${Math.floor(ply / 2) + 1}${ply % 2 ? '…' : '.'} ${san}`;

/** One key moment: find a better move yourself, then see what happened, why, and the habit to take away. */
function QuickCard({
  moment,
  index,
  total,
  retry,
  revealed,
  found,
  best,
  onShowMe,
  onLine,
  onNext,
}: {
  moment: KeyMoment;
  index: number;
  total: number;
  retry: RetryState | null;
  revealed: boolean;
  found: boolean;
  best: MoveWhy | null;
  onShowMe: () => void;
  onLine: (which: 'game' | 'better') => void;
  onNext: () => void;
}) {
  const m = moment;
  return (
    <div className="quick-card" data-moment={index}>
      <div className="quick-progress" aria-label={`Moment ${index + 1} of ${total}`}>
        {Array.from({ length: total }, (_, i) => <span key={i} className={i < index ? 'done' : i === index ? 'on' : ''} />)}
        <span className="muted small">Moment {index + 1} of {total}</span>
      </div>
      <h3 className={`quick-title ${m.kind}`}>{m.kind === 'missed-win' ? '💡' : '⚠️'} {m.title}</h3>
      <p className="quick-context">
        On move {Math.floor(m.ply / 2) + 1} you played <b>{m.played.san}</b>
        {m.spent !== null && <> after <b className={m.spent < 10 ? 'quick-fast' : ''}>{m.spent} second{m.spent === 1 ? '' : 's'}</b></>}. Your winning chances went from <b>{m.winBefore}%</b> to <b>{m.winAfter}%</b>.
      </p>
      {!revealed ? (
        <>
          <div className={`quick-task ${retry?.status ?? 'try'}`}>
            {(!retry || retry.status === 'try') && <><b>Find a better move.</b> Check the checks, captures and threats for both sides, then move a piece on the board.</>}
            {retry?.status === 'checking' && <><span className="spinner tiny" /> Checking {retry.tried}…</>}
            {retry?.status === 'wrong' && <><b>✗ {retry.tried} isn’t better.</b> {retry.tried === m.played.san ? 'That’s the move from the game. ' : ''}Try again{retry.tries >= 2 ? ', or see the answer.' : '.'}</>}
          </div>
          <div className="row">
            <button className={retry && retry.tries >= 2 ? 'btn-green' : 'btn-secondary'} onClick={onShowMe}>Show me</button>
          </div>
        </>
      ) : (
        <>
          <div className={`quick-result ${found ? 'good' : 'bad'}`}>
            {found ? <b>✓ You found it{retry?.tried ? `: ${retry.tried}` : ''}!</b> : <b>The better move was {m.best?.san ?? '—'}.</b>}
            <span className="chip-label">{TYPE_LABEL[m.type]}</span>
          </div>
          <p className="quick-explain">{m.explain}</p>
          {best && best.reasons.length > 0 && (
            <div className="quick-why">
              <div className="eyebrow">Why {best.san} works</div>
              <ReasonList reasons={best.reasons} />
            </div>
          )}
          {m.spent !== null && m.spent < 10 && <div className="quick-time">⏱ Only {m.spent}s on the move that decided the game. This is exactly the moment to slow down.</div>}
          <div className="quick-rule"><span>📌</span><div><b>Your rule</b><div>{m.rule}</div></div></div>
          <div className="why-actions">
            <button className="chip" onClick={() => onLine('game')}>▶ What happened in the game</button>
            {m.best && <button className="chip" onClick={() => onLine('better')}>▶ The better line</button>}
          </div>
          <button className="btn-green wide" onClick={onNext}>{index + 1 < total ? 'Next moment →' : 'Finish →'}</button>
        </>
      )}
    </div>
  );
}

/** The end of a quick review: what you found and the rules from this game. */
function QuickSummary({ moments, results, onAgain, onFull, onJump }: { moments: KeyMoment[]; results: ('found' | 'missed')[]; onAgain: () => void; onFull: () => void; onJump: (i: number) => void }) {
  const found = results.filter((r) => r === 'found').length;
  const rules = [...new Set(moments.map((m) => m.rule))];
  return (
    <div className="quick-card quick-summary">
      <h3>{found === moments.length ? '🏆' : '✓'} Quick review done</h3>
      <p className="muted">You found {found} of {moments.length} better move{moments.length > 1 ? 's' : ''} yourself.</p>
      <ul className="quick-list">
        {moments.map((m, i) => (
          <li key={m.ply} className={results[i] === 'found' ? 'ok' : 'bad'}>
            <button className="link" onClick={() => onJump(i)}>{results[i] === 'found' ? '✓' : '✗'} {moveLabel(m.ply, m.played.san)}</button>
            <span className="muted small"> · {TYPE_LABEL[m.type]}</span>
          </li>
        ))}
      </ul>
      <div className="eyebrow">Your rules from this game</div>
      <ul className="quick-rules">{rules.map((r) => <li key={r}>{r}</li>)}</ul>
      <div className="row">
        <button className="btn-secondary" onClick={onAgain}>Go through again</button>
        <button className="btn-secondary" onClick={onFull}>Full review</button>
      </div>
    </div>
  );
}

function PlayerBar({ p, color, clock, active, fen }: { p: PlayerInfo; color: 'w' | 'b'; clock?: number | null; active: boolean; fen: string }) {
  return (
    <div className="player-bar">
      <span className={`avatar ${color === 'w' ? 'white' : 'black'}`}>{p.name[0]?.toUpperCase()}</span>
      <span className="player-name">{p.name}</span>
      {p.rating ? <span className="player-rating">({p.rating})</span> : null}
      <Captured fen={fen} side={color} />
      {clock != null && <span className={`clock ${color === 'w' ? 'white' : 'black'} ${active ? 'active' : ''}`}>{formatClock(clock)}</span>}
    </div>
  );
}

export function AnalysisView({ cacheKey, parsed, white, black, perspective, result, meta, comments, heading, onBack, backLabel = '← Back', onAnalyzed, initialPly, showCoach = true, extraAction }: Props) {
  const last = parsed.fens.length - 1;
  const [ply, setPly] = useState(() => Math.min(initialPly ?? 0, parsed.fens.length - 1));
  const [tab, setTab] = useState<Tab>(initialPly ? 'moves' : 'report');
  const [cached] = useState(() => loadCached(cacheKey, DEEP_DEPTH));
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(cached);
  const [stage, setStage] = useState<AnalysisStage | 'done'>(cached ? 'done' : 'quick');
  const [progress, setProgress] = useState(cached ? 1 : 0);
  const [error, setError] = useState('');
  const [line, setLine] = useState<LineView | null>(null);
  const [retry, setRetry] = useState<RetryState | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  // in the one-column layout (tablet portrait, phones) the panel sits under the board: bring the board back into view
  const showBoard = () => requestAnimationFrame(() => boardRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })); // after the panel re-renders
  const onAnalyzedRef = useRef(onAnalyzed);
  useEffect(() => {
    onAnalyzedRef.current = onAnalyzed;
  });

  useEffect(() => {
    if (cached) {
      onAnalyzedRef.current?.(cached);
      return;
    }
    const ctrl = new AbortController();
    analyzeGame(
      parsed,
      (a, s, p) => {
        if (ctrl.signal.aborted) return;
        if (a) setAnalysis(a);
        setStage(s);
        setProgress(p);
      },
      ctrl.signal,
    )
      .then((final) => {
        if (!final || ctrl.signal.aborted) return;
        saveCached(cacheKey, final);
        setAnalysis(final);
        setStage('done');
        onAnalyzedRef.current?.(final);
      })
      .catch((e) => !ctrl.signal.aborted && setError(String(e)));
    return () => ctrl.abort();
  }, [parsed, cacheKey, cached]);

  // moving through the game always leaves a variation or a retry
  const select = useCallback((p: number | ((p: number) => number)) => {
    setLine(null);
    setRetry(null);
    setPly(p);
  }, []);
  const goto = useCallback(
    (p: number | ((p: number) => number)) => {
      setTab('moves');
      select(p);
    },
    [select],
  );
  const stepLine = useCallback((to: number) => setLine((l) => l && { ...l, idx: Math.max(0, Math.min(l.moves.length, to)) }), []);

  const lineRef = useRef(line);
  useEffect(() => {
    lineRef.current = line;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      const l = lineRef.current;
      if (l && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        stepLine(l.idx + (e.key === 'ArrowLeft' ? -1 : 1));
        return;
      }
      const go = (fn: (p: number) => number) => {
        e.preventDefault();
        goto(fn);
      };
      if (e.key === 'ArrowLeft') go((p) => Math.max(0, p - 1));
      if (e.key === 'ArrowRight') go((p) => Math.min(last, p + 1));
      if (e.key === 'Home') go(() => 0);
      if (e.key === 'End') go(() => last);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last, goto, stepLine]);

  const done = stage === 'done';
  const report = useMemo(() => (analysis && done ? coachReport(parsed, analysis, perspective, result) : null), [analysis, done, parsed, perspective, result]);
  // Quick Review: the moments that decided your game (your own games only, after the deep analysis)
  const moments = useMemo(() => (analysis && done && showCoach ? keyMoments(parsed, analysis, perspective) : null), [analysis, done, showCoach, parsed, perspective]);
  const [quick, setQuick] = useState<{ idx: number; revealed: boolean; results: ('found' | 'missed')[]; saved: boolean }>({ idx: 0, revealed: false, results: [], saved: false });
  const medians = useMemo(() => {
    const spent = timeSpent(parsed);
    const med = (c: 'w' | 'b') => {
      const xs = spent.filter((s, i): s is number => s !== null && parsed.moves[i].color === c).sort((a, b) => a - b);
      return xs.length ? xs[Math.floor(xs.length / 2)] : null;
    };
    return { w: med('w'), b: med('b') };
  }, [parsed]);

  const lastMove = ply > 0 ? parsed.moves[ply - 1] : null;
  const review = ply > 0 && analysis ? analysis.reviews[ply - 1] : null;
  const evalHere = analysis?.evals[ply];
  const evalBefore = ply > 0 ? analysis?.evals[ply - 1] : undefined;
  const comment = comments?.[ply];

  // memoized so the board doesn't re-render while the engine reports progress
  const squares = useMemo<Record<string, string>>(() => {
    if (!lastMove) return {};
    const c = review?.classification;
    const tint = c && (isError(c) || c === 'inaccuracy' || c === 'brilliant' || c === 'great') ? `${CLASS_META[c].color}77` : 'rgba(255,255,51,0.45)';
    return { [lastMove.from]: tint, [lastMove.to]: tint };
  }, [lastMove, review]);
  // show the move that SHOULD have been played (from the previous position) when this move was an error
  const arrows = useMemo(() => {
    if (review && review.bestSan && evalBefore?.bestMove && (review.classification === 'inaccuracy' || isError(review.classification))) {
      return [[evalBefore.bestMove, 'rgba(129,182,76,0.9)'] as [string, string]];
    }
    return [];
  }, [review, evalBefore]);
  const badge = useMemo(() => (lastMove && review ? { square: lastMove.to, c: review.classification } : undefined), [lastMove, review]);

  // best move and the reasons behind it (also why a good move was good)
  const why = useMemo(() => (analysis && ply > 0 ? explainChoice(parsed, analysis, ply - 1) : null), [analysis, parsed, ply]);

  const openLine = useCallback(
    (base: number, pv: string[], title: string) => {
      const c = new Chess(parsed.fens[base]);
      const fens = [c.fen()];
      const moves: LineView['moves'] = [];
      for (const u of pv.slice(0, 10)) {
        try {
          const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
          fens.push(c.fen());
          moves.push({ from: m.from, to: m.to, san: m.san });
        } catch {
          break;
        }
      }
      setRetry(null);
      setLine({ base, fens, moves, idx: Math.min(1, moves.length), title });
    },
    [parsed],
  );
  // in a variation or a retry the bar shows the evaluation with best play from that position
  const barEval = line ? analysis?.evals[line.base] : retry ? analysis?.evals[retry.i] : evalHere;
  const lineSquares = useMemo<Record<string, string>>(() => {
    const m = line && line.idx > 0 ? line.moves[line.idx - 1] : null;
    return m ? { [m.from]: 'rgba(92,139,176,0.6)', [m.to]: 'rgba(92,139,176,0.6)' } : {};
  }, [line]);

  const startMoment = useCallback(
    (idx: number) => {
      if (!moments) return;
      setTab('quick');
      setQuick((q) => ({ ...q, idx, revealed: false }));
      setLine(null);
      if (idx >= moments.length) {
        setRetry(null);
        return;
      }
      const m = moments[idx];
      setPly(m.ply); // the position before your move
      setRetry({ i: m.ply, fen: parsed.fens[m.ply], status: 'try', tries: 0 });
      showBoard();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [moments, parsed],
  );
  const revealMoment = useCallback((result: 'found' | 'missed') => {
    // the moment joins your review deck (missed ones come back first)
    const m = moments?.[quick.idx];
    if (m?.best && !quick.revealed) {
      const opponent = perspective === 'w' ? black.name : white.name;
      addCard(
        { kind: 'mistake', ref: `${cacheKey}#${m.ply}`, title: `Your game vs ${opponent}`, data: { fen: parsed.fens[m.ply], uci: m.played.uci, best: m.best.uci, explain: m.explain, source: `From your game vs ${opponent}, move ${Math.floor(m.ply / 2) + 1}` } },
        result === 'found' ? GOOD : AGAIN,
      );
    }
    setQuick((q) => {
      if (q.revealed) return q;
      const results = [...q.results];
      results[q.idx] = result;
      return { ...q, revealed: true, results };
    });
  }, [moments, quick.idx, quick.revealed, perspective, white.name, black.name, cacheKey, parsed]);
  // finding a good move yourself reveals the explanation
  useEffect(() => {
    if (tab !== 'quick' || !moments || quick.revealed || !retry) return;
    if (retry.i === moments[quick.idx]?.ply && (retry.status === 'right' || retry.status === 'alt')) revealMoment('found');
  }, [tab, moments, quick.revealed, quick.idx, retry, revealMoment]);
  // the end of a quick review is remembered (the dashboard shows your most common mistake)
  useEffect(() => {
    if (!moments?.length || quick.idx < moments.length || quick.saved) return;
    recordQuickReview(cacheKey, moments, quick.results.filter((r) => r === 'found').length);
    setQuick((q) => ({ ...q, saved: true }));
  }, [moments, quick, cacheKey]);

  const onRetryMove = useCallback(
    (from: Square, to: Square, promotion: Promotion = 'q'): boolean => {
      if (!retry || !analysis) return false;
      const i = retry.i;
      const c = new Chess(parsed.fens[i]);
      let m;
      try {
        m = c.move({ from, to, promotion });
      } catch {
        return false;
      }
      const uci = m.from + m.to + (m.promotion ?? '');
      const tries = retry.tries;
      if (uci === analysis.evals[i].bestMove) {
        setRetry({ ...retry, fen: c.fen(), status: 'right', tried: m.san });
        return true;
      }
      if (uci === parsed.moves[i].uci) {
        setRetry({ ...retry, status: 'wrong', tries: tries + 1, tried: m.san });
        return false;
      }
      // another move: accept it if Stockfish rates it (almost) as highly as the best one
      setRetry({ ...retry, fen: c.fen(), status: 'checking', tried: m.san });
      const me = parsed.moves[i].color;
      const bestWin = moverWin(analysis.evals[i], me);
      const settle = (win: number) =>
        setRetry((r) =>
          r && r.i === i && r.status === 'checking' ? (bestWin - win < 4 ? { ...r, status: 'alt' } : { ...r, fen: parsed.fens[i], status: 'wrong', tries: tries + 1 }) : r,
        );
      if (c.isCheckmate()) settle(100);
      else
        getEngine()
          .analyze(c.fen(), 12)
          .then((r) => settle(100 - winPct(r.mate !== null ? (r.mate > 0 ? 10000 : -10000) : (r.cp ?? 0)))); // r is from the opponent's side
      return true;
    },
    [retry, analysis, parsed],
  );

  const clockFor = (color: 'w' | 'b') => {
    if (!parsed.clocks) return null;
    for (let j = ply - 1; j >= 0; j--) if (parsed.moves[j].color === color) return parsed.clocks[j];
    return parsed.timeControl?.base ?? null;
  };
  const toMove = parsed.fens[ply].split(' ')[1] as 'w' | 'b';
  const boardFen = retry ? retry.fen : line ? line.fens[line.idx] : parsed.fens[ply];
  const top = perspective === 'w' ? { p: black, c: 'b' as const } : { p: white, c: 'w' as const };
  const bottom = perspective === 'w' ? { p: white, c: 'w' as const } : { p: black, c: 'b' as const };

  const spentHere = useMemo(() => (ply > 0 ? timeSpent(parsed)[ply - 1] : null), [parsed, ply]);
  // your clock in this game: time used and moves made in under 5 seconds
  const myClock = useMemo(() => {
    if (!parsed.timeControl || !parsed.clocks) return null;
    const mine = timeSpent(parsed).filter((t, i): t is number => t !== null && parsed.moves[i].color === perspective);
    if (!mine.length) return null;
    return { used: mine.reduce((a, b) => a + b, 0), base: parsed.timeControl.base, fast: mine.filter((t) => t < 5).length, moves: mine.length };
  }, [parsed, perspective]);
  const explanation = useMemo(() => {
    if (!analysis || !review || ply === 0 || !lastMove) return null;
    const c = review.classification;
    if (isError(c) || c === 'inaccuracy') {
      // reuse the full explanation, minus the "X was a mistake (eval)" opener shown in the title
      return explainMove(parsed, analysis, ply - 1, medians[lastMove.color]).text.replace(/^.*?\)\.\s*/, '');
    }
    if (c === 'brilliant') return 'A brilliant sacrifice: you give up material, and the engine confirms it works.';
    if (c === 'great') return 'The only good move here. Every alternative was clearly worse.';
    if (c === 'book') return 'A well-known opening move.';
    if (review.bestSan) return `The engine slightly preferred ${review.bestSan}.`;
    return null;
  }, [analysis, review, ply, lastMove, parsed, medians]);

  const buildFacts = useCallback(() => {
    if (!analysis || !report) return {};
    const me = perspective === 'w' ? white : black;
    const opp = perspective === 'w' ? black : white;
    return coachFacts(parsed, analysis, report, {
      player: me.name,
      opponent: opp.name,
      playerRating: me.rating,
      opponentRating: opp.rating,
      result,
      opening: meta?.opening,
      timeControl: meta?.timeControl,
    });
  }, [analysis, report, perspective, white, black, parsed, result, meta]);

  const coach = (() => {
    if (!analysis) return null;
    if (!lastMove || !review) return <>Let’s go through this game. Use the arrows or ← → keys to step through the moves.</>;
    const m = CLASS_META[review.classification];
    return (
      <>
        <div className="coach-title">
          <ClassIcon c={review.classification} size={22} />
          <b>{lastMove.san}</b>&nbsp;is {m.verb}
          <span className={`eval-chip ${evalHere && evalHere.cp < 0 ? 'neg' : ''}`}>{evalText(evalHere)}</span>
        </div>
        {explanation && <div className="coach-sub">{explanation}</div>}
        {spentHere !== null && <div className="coach-time">⏱ {spentHere < 10 ? spentHere.toFixed(1) : Math.round(spentHere)}s on this move</div>}
      </>
    );
  })();

  return (
    <div className="review">
      <div className="review-top">
        <button className="btn-ghost" onClick={onBack}>{backLabel}</button>
        <h2 className="review-title">
          {heading ?? (
            <>
              {white.name} <span className="muted">vs</span> {black.name}
            </>
          )}
        </h2>
      </div>

      <div className="review-layout">
        <div className="board-area" ref={boardRef}>
          <EvalBar whitePct={whitePctOf(barEval)} label={evalText(barEval)} flipped={perspective === 'b'} />
          <div className="board-col">
            <PlayerBar p={top.p} color={top.c} clock={clockFor(top.c)} active={toMove === top.c && ply < last} fen={boardFen} />
            <Board
              id="analysis-board"
              fen={boardFen}
              orientation={perspective === 'b' ? 'black' : 'white'}
              arrows={retry || line ? NO_ARROWS : arrows}
              squares={retry ? NO_SQUARES : line ? lineSquares : squares}
              badge={retry || line ? undefined : badge}
              onMove={retry && (retry.status === 'try' || retry.status === 'wrong') ? onRetryMove : undefined}
            />
            <PlayerBar p={bottom.p} color={bottom.c} clock={clockFor(bottom.c)} active={toMove === bottom.c && ply < last} fen={boardFen} />
          </div>
        </div>

        <section className="side-panel">
          <header className="side-head">
            <span className="side-head-title">★ Game Review</span>
            <span className="side-head-actions">
              {extraAction && (
                <button className="icon-btn" onClick={() => extraAction.onClick(ply)}>
                  {extraAction.label}
                </button>
              )}
              <button className="icon-btn" title="Open this position on the analysis board" onClick={() => navigate(`explore?fen=${encodeURIComponent(parsed.fens[ply])}`)}>
                Analyze ↗
              </button>
            </span>
          </header>
          <div className="seg-tabs">
            {showCoach && moments && moments.length > 0 && (
              <button className={tab === 'quick' ? 'on' : ''} onClick={() => (tab === 'quick' ? undefined : startMoment(Math.min(quick.idx, moments.length)))}>⚡ Quick</button>
            )}
            <button className={tab === 'report' ? 'on' : ''} onClick={() => setTab('report')}>Report</button>
            <button className={tab === 'moves' ? 'on' : ''} onClick={() => setTab('moves')}>Moves</button>
            {showCoach && <button className={tab === 'coach' ? 'on' : ''} onClick={() => setTab('coach')}>Coach</button>}
          </div>

          {stage !== 'done' && !error && (
            <div className="stage-bar">
              {analysis ? (
                <>
                  <span className="spinner tiny" /> Quick review ready · deep analysis {Math.round(progress * 100)}%
                </>
              ) : (
                <>
                  <span className="spinner tiny" /> Analyzing…
                </>
              )}
              <div className="progress thin"><div style={{ transform: `scaleX(${analysis ? progress : 0.05})` }} /></div>
            </div>
          )}

          <div className="side-body">
            {error && <div className="error">{error}</div>}

            {tab === 'report' && analysis && (
              <Summary
                analysis={analysis}
                parsed={parsed}
                white={white}
                black={black}
                verdict={showCoach ? report?.verdict : undefined}
                onStart={() => goto(1)}
                onCoach={() => setTab('coach')}
                moments={showCoach ? moments : undefined}
                onQuick={() => startMoment(0)}
                clockLine={showCoach ? myClock : null}
              />
            )}

            {tab === 'quick' && analysis && moments && moments.length > 0 && (
              <>
                {line && <LineCard line={line} onStep={stepLine} onClose={() => setLine(null)} />}
                {quick.idx < moments.length ? (
                  <QuickCard
                    moment={moments[quick.idx]}
                    index={quick.idx}
                    total={moments.length}
                    retry={retry}
                    revealed={quick.revealed}
                    found={quick.results[quick.idx] === 'found'}
                    best={explainChoice(parsed, analysis, moments[quick.idx].ply).best}
                    onShowMe={() => {
                      revealMoment('missed');
                      const m = moments[quick.idx];
                      openLine(m.ply, analysis.evals[m.ply].pv ?? (m.best ? [m.best.uci] : []), 'The better move');
                      showBoard();
                    }}
                    onLine={(which) => {
                      const m = moments[quick.idx];
                      if (which === 'game') openLine(m.ply, [m.played.uci, ...(analysis.evals[m.ply + 1]?.pv ?? [])], 'What happened in the game');
                      else openLine(m.ply, analysis.evals[m.ply].pv ?? (m.best ? [m.best.uci] : []), 'The better line');
                      showBoard();
                    }}
                    onNext={() => startMoment(quick.idx + 1)}
                  />
                ) : (
                  <QuickSummary
                    moments={moments}
                    results={quick.results}
                    onAgain={() => {
                      setQuick({ idx: 0, revealed: false, results: [], saved: true });
                      startMoment(0);
                    }}
                    onFull={() => goto(1)}
                    onJump={(i) => goto(moments[i].ply + 1)}
                  />
                )}
              </>
            )}

            {tab === 'moves' && (
              <>
                {analysis && retry && (
                  <RetryCard
                    retry={retry}
                    color={parsed.moves[retry.i].color}
                    playedSan={parsed.moves[retry.i].san}
                    best={why?.best ?? null}
                    onShow={() => {
                      openLine(retry.i, analysis.evals[retry.i].pv ?? [], 'Best line');
                      showBoard();
                    }}
                    onClose={() => setRetry(null)}
                  />
                )}
                {analysis && !retry && line && <LineCard line={line} onStep={stepLine} onClose={() => setLine(null)} />}
                {analysis && !retry && !line && (
                  <div className="coach">
                    <span className="coach-avatar">♞</span>
                    <div className="coach-bubble">{coach}</div>
                  </div>
                )}
                {analysis && !retry && !line && why && review && (
                  <WhyCard
                    why={why}
                    classification={review.classification}
                    evalBest={evalText(evalBefore)}
                    evalPlayed={evalText(evalHere)}
                    onLine={(pv, title) => {
                      openLine(ply - 1, pv, title);
                      showBoard();
                    }}
                    onRetry={() => {
                      setLine(null);
                      setRetry({ i: ply - 1, fen: parsed.fens[ply - 1], status: 'try', tries: 0 });
                      showBoard();
                    }}
                  />
                )}
                {comment && <div className="note">💬 {comment}</div>}
                {analysis && <EvalGraph evals={analysis.evals} reviews={analysis.reviews} ply={ply} onSelect={select} />}
                <MoveList parsed={parsed} reviews={analysis?.reviews} comments={comments} ply={ply} onSelect={select} />
              </>
            )}

            {tab === 'coach' &&
              (report ? (
                <CoachPanel report={report} buildFacts={buildFacts} onJump={goto} onPractice={(p) => navigate(`practice?fen=${encodeURIComponent(parsed.fens[p])}`)} />
              ) : (
                <div className="analyzing">
                  <span className="spinner" />
                  <div className="muted">The coach is waiting for the deep analysis to finish…</div>
                </div>
              ))}
          </div>

          <footer className="side-foot">
            <button className="nav-btn" onClick={() => goto(0)} aria-label="First move">⏮</button>
            <button className="nav-btn" onClick={() => (line ? stepLine(line.idx - 1) : goto((p) => Math.max(0, p - 1)))} aria-label="Previous move">◀</button>
            <button className="nav-btn main" onClick={() => (line ? stepLine(line.idx + 1) : goto((p) => Math.min(last, p + 1)))} aria-label="Next move">▶</button>
            <button className="nav-btn" onClick={() => goto(last)} aria-label="Last move">⏭</button>
          </footer>
        </section>
      </div>
    </div>
  );
}
