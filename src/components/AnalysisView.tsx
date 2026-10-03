import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEEP_DEPTH, analyzeGame, estimateGameRating, formatClock, isError, loadCached, saveCached, timeSpent, winPct } from '../lib/analysis';
import type { AnalysisStage, Classification, GameAnalysis, ParsedGame, PositionEval } from '../lib/analysis';
import { CLASS_META, CLASS_ORDER } from '../lib/classMeta';
import { coachFacts, coachReport, explainMove } from '../lib/coach';
import { formatScore } from '../lib/chess';
import { navigate } from '../lib/router';
import { Board } from './Board';
import { ClassIcon } from './icons';
import { EvalBar } from './EvalBar';
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

type Tab = 'report' | 'moves' | 'coach';

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
}: {
  analysis: GameAnalysis;
  parsed: ParsedGame;
  white: PlayerInfo;
  black: PlayerInfo;
  verdict?: string;
  onStart: () => void;
  onCoach: () => void;
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
      <button className="btn-green big" onClick={onStart}>Start Review</button>
    </div>
  );
}

function PlayerBar({ p, color, clock, active }: { p: PlayerInfo; color: 'w' | 'b'; clock?: number | null; active: boolean }) {
  return (
    <div className="player-bar">
      <span className={`avatar ${color === 'w' ? 'white' : 'black'}`}>{p.name[0]?.toUpperCase()}</span>
      <span className="player-name">{p.name}</span>
      {p.rating ? <span className="player-rating">({p.rating})</span> : null}
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

  const goto = useCallback((p: number) => {
    setTab('moves');
    setPly(p);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      const go = (fn: (p: number) => number) => {
        e.preventDefault();
        setTab('moves');
        setPly(fn);
      };
      if (e.key === 'ArrowLeft') go((p) => Math.max(0, p - 1));
      if (e.key === 'ArrowRight') go((p) => Math.min(last, p + 1));
      if (e.key === 'Home') go(() => 0);
      if (e.key === 'End') go(() => last);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last]);

  const done = stage === 'done';
  const report = useMemo(() => (analysis && done ? coachReport(parsed, analysis, perspective, result) : null), [analysis, done, parsed, perspective, result]);
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

  const clockFor = (color: 'w' | 'b') => {
    if (!parsed.clocks) return null;
    for (let j = ply - 1; j >= 0; j--) if (parsed.moves[j].color === color) return parsed.clocks[j];
    return parsed.timeControl?.base ?? null;
  };
  const toMove = parsed.fens[ply].split(' ')[1] as 'w' | 'b';
  const top = perspective === 'w' ? { p: black, c: 'b' as const } : { p: white, c: 'w' as const };
  const bottom = perspective === 'w' ? { p: white, c: 'w' as const } : { p: black, c: 'b' as const };

  const spentHere = useMemo(() => (ply > 0 ? timeSpent(parsed)[ply - 1] : null), [parsed, ply]);
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
        <div className="board-area">
          <EvalBar whitePct={whitePctOf(evalHere)} label={evalText(evalHere)} flipped={perspective === 'b'} />
          <div className="board-col">
            <PlayerBar p={top.p} color={top.c} clock={clockFor(top.c)} active={toMove === top.c && ply < last} />
            <Board id="analysis-board" fen={parsed.fens[ply]} orientation={perspective === 'b' ? 'black' : 'white'} arrows={arrows} squares={squares} badge={badge} />
            <PlayerBar p={bottom.p} color={bottom.c} clock={clockFor(bottom.c)} active={toMove === bottom.c && ply < last} />
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
              />
            )}

            {tab === 'moves' && (
              <>
                {analysis && (
                  <div className="coach">
                    <span className="coach-avatar">♞</span>
                    <div className="coach-bubble">{coach}</div>
                  </div>
                )}
                {comment && <div className="note">💬 {comment}</div>}
                {analysis && <EvalGraph evals={analysis.evals} reviews={analysis.reviews} ply={ply} onSelect={setPly} />}
                <MoveList parsed={parsed} reviews={analysis?.reviews} comments={comments} ply={ply} onSelect={setPly} />
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
            <button className="nav-btn" onClick={() => { setTab('moves'); setPly((p) => Math.max(0, p - 1)); }} aria-label="Previous move">◀</button>
            <button className="nav-btn main" onClick={() => { setTab('moves'); setPly((p) => Math.min(last, p + 1)); }} aria-label="Next move">▶</button>
            <button className="nav-btn" onClick={() => goto(last)} aria-label="Last move">⏭</button>
          </footer>
        </section>
      </div>
    </div>
  );
}
