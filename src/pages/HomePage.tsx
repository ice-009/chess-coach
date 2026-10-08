// The dashboard. Built around four questions, in this order: what should I do now (next up + today's plan),
// where am I (ratings and their trend), what is going wrong (focus areas from recent games), and am I getting
// better (skills, activity, the road to 1500).
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ALL_LESSONS } from '../data/lessons';
import { DRILLS } from '../data/drills';
import { activityOn, ago, streak, today } from '../lib/activity';
import { useAccount } from '../lib/account';
import { accuracyIndex } from '../lib/analysis';
import { getArchives, getGames, getProfile } from '../lib/chesscom';
import type { Profile } from '../lib/chesscom';
import { gameRows, openingStats, overview, recommendations, scorePct } from '../lib/insights';
import type { GameRow } from '../lib/insights';
import { loadResults, ownColor, quizLines, quizScope } from '../lib/openingQuiz';
import { getRating } from '../lib/puzzles';
import { dueCount } from '../lib/deck';
import { navigate } from '../lib/router';
import { KEYS, getMe, load, save } from '../lib/storage';
import { STATIC_HOST } from '../lib/host';
import { LineChart } from '../components/LineChart';
import { clockSummary, tiltCheck } from '../lib/clockStats';
import type { ClockSummary } from '../lib/clockStats';
import { commonMistake } from '../lib/quickReviews';
import { SyncBadge } from '../components/SyncBadge';

// activity heatmap: ordinal one-hue ramp, validated against the panel surface (all steps pass, light end 2.56:1)
const RAMP = ['#4d6b35', '#5f8a3c', '#76a845', '#97cc5c'];
const stepOf = (n: number) => (n >= 30 ? 3 : n >= 15 ? 2 : n >= 5 ? 1 : 0);
const DAY = 86400_000;

interface StageItem {
  label: string;
  href: string;
  done?: boolean;
}

function stages(lessons: string[], drills: Record<string, number>): { title: string; range: [number, number]; focus: string; items: StageItem[] }[] {
  const L = (id: string) => lessons.includes(id);
  const D = (id: string) => !!drills[id];
  return [
    {
      title: 'Stop giving pieces away',
      range: [0, 1000],
      focus: 'Most games at this level are lost by hanging pieces and missing one-move threats.',
      items: [
        { label: 'Lesson: the blunder check (checks, captures, threats)', href: '#/learn/blunder-check', done: L('blunder-check') },
        { label: 'Puzzles: hanging pieces', href: '#/train/theme/hangingPiece' },
        { label: 'Puzzles: mate in 1', href: '#/train/theme/mateIn1' },
        { label: 'Drill: king and queen vs king', href: '#/practice/drill/queen-mate', done: D('queen-mate') },
        { label: 'Drill: king and rook vs king', href: '#/practice/drill/rook-mate', done: D('rook-mate') },
        { label: 'Lesson: the golden rules of the opening', href: '#/learn/opening-rules', done: L('opening-rules') },
        { label: 'Lesson: the centre and king safety', href: '#/learn/center-king', done: L('center-king') },
      ],
    },
    {
      title: 'Win games with tactics',
      range: [1000, 1250],
      focus: 'Now the points come from spotting forks, pins and mates, and from knowing a simple repertoire.',
      items: [
        { label: 'Puzzles: forks', href: '#/train/theme/fork' },
        { label: 'Puzzles: pins and skewers', href: '#/train/theme/pin' },
        { label: 'Puzzles: mate in 2', href: '#/train/theme/mateIn2' },
        { label: 'Lessons: forks, pins, discovered attacks', href: '#/learn/forks', done: L('forks') && L('pins-skewers') && L('discovered') },
        { label: 'Drill your repertoire (Openings)', href: '#/openings' },
        { label: 'Drills: opposition and key squares', href: '#/practice/drill/kp-key', done: D('kp-key') && D('kp-opposition') },
      ],
    },
    {
      title: 'Think, plan and convert',
      range: [1250, 1500],
      focus: 'Calculate a few moves deep, use your time well, and turn winning positions into wins.',
      items: [
        { label: 'Lesson: how to calculate', href: '#/learn/calculation', done: L('calculation') },
        { label: 'Puzzles: mate in 3 and sacrifices', href: '#/train/theme/mateIn3' },
        { label: 'Lessons: attacking the king, converting a won game', href: '#/learn/king-attack', done: L('king-attack') && L('converting') },
        { label: 'Drill: Lucena (winning rook endgame)', href: '#/practice/drill/lucena', done: D('lucena') },
        { label: 'Drill: Philidor (drawing rook endgame)', href: '#/practice/drill/philidor', done: D('philidor') },
        { label: 'Lessons: pawn structure, weak pawns and passed pawns', href: '#/learn/pawn-structure', done: L('pawn-structure') && L('pawn-weaknesses') && L('passed-pawns') },
        { label: 'Lessons: rooks on open files, good and bad bishops, outposts', href: '#/learn/open-files', done: L('open-files') && L('bishops') && L('pieces-activity') },
        { label: 'Lessons: pawn breaks, trades and making a plan', href: '#/learn/pawn-breaks', done: L('pawn-breaks') && L('trades') && L('planning') },
        { label: 'Lesson: time management', href: '#/learn/time', done: L('time') },
        { label: 'Study a master game a week (Masters)', href: '#/masters' },
      ],
    },
  ];
}

// ── chess.com: profile and the last two months of games, fetched once per visit to the app ──
interface ChessData {
  profile: Profile | null;
  rows: GameRow[];
}
const chessCache = new Map<string, Promise<ChessData>>();
function loadChess(user: string): Promise<ChessData> {
  if (!chessCache.has(user)) {
    const p = Promise.all([
      getProfile(user).catch(() => null),
      getArchives(user)
        .then((a) => Promise.all(a.slice(0, 2).map(getGames)))
        .then((months) => gameRows(months.flat(), user))
        .catch(() => [] as GameRow[]),
    ]).then(([profile, rows]) => ({ profile, rows }));
    p.then((d) => !d.profile && chessCache.delete(user)); // offline or not found: try again next time
    chessCache.set(user, p);
  }
  return chessCache.get(user)!;
}
function useChess(user: string) {
  const [state, setState] = useState<{ user: string; data: ChessData | null }>({ user, data: null });
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadChess(user).then((data) => !cancelled && setState({ user, data }));
    return () => {
      cancelled = true;
    };
  }, [user]);
  return state.user === user ? state.data : null;
}

/** Re-render when progress changes here (activity) or arrives from another device (sync). */
function useProgressVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const f = () => setV((n) => n + 1);
    window.addEventListener('cca-synced', f);
    window.addEventListener('cca-activity', f);
    return () => {
      window.removeEventListener('cca-synced', f);
      window.removeEventListener('cca-activity', f);
    };
  }, []);
  return v;
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

// ── small pieces ──
function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="spark" />;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 30 - ((v - lo) / (hi - lo || 1)) * 26]);
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true">
      <path d={pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="2.6" />
    </svg>
  );
}

function Delta({ n, span }: { n: number; span: string }) {
  if (!n) return <span className="delta flat">± 0 {span}</span>;
  return <span className={`delta ${n > 0 ? 'up' : 'down'}`}>{n > 0 ? '▲' : '▼'} {Math.abs(n)} {span}</span>;
}

function Ring({ done, total }: { done: number; total: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox="0 0 64 64" role="img" aria-label={`${done} of ${total} done today`}>
      <circle cx="32" cy="32" r={r} className="ring-bg" />
      {done > 0 && <circle cx="32" cy="32" r={r} className="ring-fg" strokeDasharray={`${(done / total) * c} ${c}`} transform="rotate(-90 32 32)" />}
      <text x="32" y="37" textAnchor="middle">{done}/{total}</text>
    </svg>
  );
}

function ConnectChessCom({ onSet }: { onSet: (u: string) => void }) {
  const [v, setV] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    const name = v.trim().toLowerCase();
    if (!name) return;
    save(KEYS.me, name);
    onSet(name);
  }
  return (
    <form className="kpi connect" onSubmit={submit}>
      <b>Connect chess.com</b>
      <span className="muted small">Your ratings, recent games and what to work on appear here.</span>
      <div className="row">
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="chess.com username" aria-label="Your chess.com username" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <button className="btn-green">Connect</button>
      </div>
    </form>
  );
}

const KIND_LABEL: Record<string, [string, string]> = {
  puzzle: ['puzzle', 'puzzles'], review: ['review', 'reviews'], lesson: ['lesson', 'lessons'], drill: ['drill', 'drills'],
  game: ['game reviewed', 'games reviewed'], vision: ['vision run', 'vision runs'], opening: ['opening line', 'opening lines'],
  safety: ['safety check', 'safety checks'],
};

/** A goal meter: the value as a bar, a tick at the goal, and the verdict in words (not colour alone). */
function Meter({ label, value, pct, goal, ok, goalText }: { label: string; value: string; pct: number; goal: number; ok: boolean; goalText: string }) {
  return (
    <div className={`meter ${ok ? 'ok' : 'off'}`}>
      <div className="row-between">
        <span>{label}</span>
        <b>{value}</b>
      </div>
      <div className="meter-bar" role="img" aria-label={`${label}: ${value}, ${goalText}, ${ok ? 'goal met' : 'not yet'}`}>
        <span style={{ width: `${Math.min(100, pct)}%` }} />
        <i style={{ left: `${goal}%` }} />
      </div>
      <div className="muted small">{ok ? '✓ ' : '○ '}{goalText}</div>
    </div>
  );
}

/** Time used in your recent games (oldest to newest), against the goal line. */
function ClockCard({ clock, timeClass, days }: { clock: ClockSummary; timeClass: string; days: number }) {
  const advice = !clock.usedOk && !clock.fastOk
    ? `You finish your games with ${(clock.baseMin - clock.usedMin).toFixed(1)} minutes left on average. Spend them: before every capture, check or threat, take 10 seconds.`
    : !clock.usedOk
      ? 'You still finish with plenty of time left. Use it on the critical moves.'
      : !clock.fastOk
        ? 'Good overall, but too many instant moves. Take a few seconds even on “obvious” ones.'
        : 'Good clock use: you’re thinking before you move.';
  return (
    <section className="panel p-clock">
      <div className="row-between">
        <h3>Your clock</h3>
        <span className="muted small">{timeClass} · last {days} days · {clock.games} game{clock.games === 1 ? '' : 's'}</span>
      </div>
      <Meter label="Time used per game" value={`${clock.usedMin} of ${clock.baseMin} min`} pct={clock.usedPct} goal={clock.goals.usedPct} ok={clock.usedOk} goalText={`goal: use ${clock.goals.usedPct}%+ of your clock`} />
      <Meter label="Moves in under 5 seconds" value={`${clock.fastShare}%`} pct={clock.fastShare} goal={clock.goals.fastShare} ok={clock.fastOk} goalText={`goal: under ${clock.goals.fastShare}%`} />
      <div className="clock-games" role="img" aria-label={`Clock used in your last ${clock.recent.length} games: ${clock.recent.map((g) => `${g.usedPct}%`).reverse().join(', ')}`}>
        {[...clock.recent].reverse().map((g) => (
          <span key={g.url} className={`cg ${g.outcome}`} style={{ height: `${Math.max(4, g.usedPct)}%` }} title={`${new Date(g.end).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}: ${g.outcome}, ${Math.round(g.used / 60)} of ${Math.round(g.base / 60)} min used`} />
        ))}
        <i className="goal-line" style={{ bottom: `${clock.goals.usedPct}%` }} />
      </div>
      <div className="clock-legend muted small"><span><i className="cg-key win" />won</span><span><i className="cg-key loss" />lost</span><span><i className="cg-key draw" />drawn</span><span className="dash-key">goal</span></div>
      <p className="muted small clock-advice">{advice}</p>
    </section>
  );
}

/** The last 12 weeks, one column per week (Monday on top), and a readout for the day you point at. */
function Heatmap() {
  const all = load<Record<string, Record<string, number>>>(KEYS.activity, {});
  const cells = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - ((end.getDay() + 6) % 7) - 11 * 7); // the Monday 11 weeks before this week's
    const out: { key: string; total: number; future: boolean; date: Date }[] = [];
    for (let i = 0; i < 12 * 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = today(d);
      const total = Object.entries(all[key] ?? {}).reduce((a, [k, n]) => a + (k === 'puzzleSolved' ? 0 : n), 0);
      out.push({ key, total, future: d > end, date: d });
    }
    return out;
  }, [all]);
  const [pick, setPick] = useState(today());
  const picked = cells.find((c) => c.key === pick) ?? cells[cells.length - 1];
  const detail = Object.entries(all[picked.key] ?? {}).filter(([k, n]) => KIND_LABEL[k] && n).map(([k, n]) => `${n} ${KIND_LABEL[k][n === 1 ? 0 : 1]}`);
  const activeDays = cells.filter((c) => c.total > 0).length;
  return (
    <div className="heat-wrap">
      <div className="heat" role="img" aria-label={`Training on ${activeDays} of the last 84 days`}>
        {cells.map((c) => (
          <span
            key={c.key}
            className={`heat-day ${c.key === picked.key ? 'picked' : ''}`}
            style={{ background: c.future ? 'transparent' : c.total ? RAMP[stepOf(c.total)] : 'var(--panel-3)' }}
            title={c.future ? undefined : `${c.date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}: ${c.total} training actions`}
            onPointerEnter={(e) => e.pointerType === 'mouse' && !c.future && setPick(c.key)}
            onClick={() => !c.future && setPick(c.key)}
          />
        ))}
      </div>
      <div className="heat-foot">
        <span className="small">
          <b>{picked.key === today() ? 'Today' : picked.date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</b>
          <span className="muted"> · {detail.length ? detail.join(', ') : 'no training'}</span>
        </span>
        <span className="strip-legend muted small">
          <span>Less</span>
          {RAMP.map((c) => <span key={c} className="strip-key" style={{ background: c }} />)}
          <span>More</span>
        </span>
      </div>
    </div>
  );
}

interface Focus {
  title: string;
  why: string;
  href: string;
  action: string;
  icon: string;
}

export function HomePage() {
  useProgressVersion();
  const account = useAccount();
  const [me, setMe] = useState(getMe);
  useEffect(() => {
    const f = () => setMe(getMe());
    window.addEventListener('cca-synced', f);
    return () => window.removeEventListener('cca-synced', f);
  }, []);
  const chess = useChess(me);
  const [series, setSeries] = useState<string | null>(null);
  const [nudgeHidden, setNudgeHidden] = useState(() => load(KEYS.me + '-nudge-hidden', false));

  // ── progress on this device ──
  const day = activityOn(today());
  const due = dueCount();
  const lessons = load<string[]>(KEYS.lessonsDone, []);
  const drills = load<Record<string, number>>(KEYS.drillsDone, {});
  const puzzle = getRating();
  const s = streak();
  const acc = accuracyIndex();

  // ── chess.com ──
  const rows = chess?.rows ?? [];
  const classes = ['rapid', 'blitz', 'bullet', 'daily'].filter((c) => rows.some((r) => r.timeClass === c));
  const ratingOf = (cls: string) => chess?.profile?.ratings.find((r) => r.label.toLowerCase() === cls)?.rating ?? rows.find((r) => r.timeClass === cls)?.myRating;
  const historyOf = (cls: string) => rows.filter((r) => r.timeClass === cls).map((r) => ({ x: +r.date, y: r.myRating })).sort((a, b) => a.x - b.x);
  const deltaOf = (cls: string, days: number) => {
    const h = historyOf(cls).filter((p) => p.x > Date.now() - days * DAY);
    return h.length ? (ratingOf(cls) ?? h[h.length - 1].y) - h[0].y : 0;
  };
  // rapid leads when you play it (it's the rating that reflects how well you think); otherwise your most played
  const recentRapid = rows.some((r) => r.timeClass === 'rapid' && +r.date > Date.now() - 30 * DAY);
  const count = (c: string) => rows.filter((r) => r.timeClass === c).length;
  const tiles = [...classes].sort((a, b) => (recentRapid ? Number(b === 'rapid') - Number(a === 'rapid') : 0) || count(b) - count(a)).slice(0, 2);
  const month = rows.filter((r) => +r.date > Date.now() - 30 * DAY);
  const rec = overview(month).all;
  const puzzleDelta = (() => {
    const h = puzzle.history.filter((p) => p.t > Date.now() - 7 * DAY);
    return h.length ? puzzle.rating - (puzzle.history[puzzle.history.indexOf(h[0]) - 1]?.r ?? 1000) : 0;
  })();

  // ── today's plan and the one thing to do next ──
  const latestUnreviewedLoss = rows.find((r) => r.outcome === 'loss' && !acc[r.game.url]);
  const plan = [
    // your review deck: what's due comes first, because remembering what you've learned beats new material
    ...(due > 0 || (day.review ?? 0) > 0
      ? [{ label: due ? `Daily review (${due} due)` : 'Daily review done', short: `Daily review: ${due} card${due > 1 ? 's' : ''}`, why: 'Positions you missed and things you learned come back just before you’d forget them.', done: due === 0, href: '#/train/review' }]
      : []),
    { label: `Solve 10 puzzles (${Math.min(10, day.puzzle ?? 0)}/10)`, short: 'Solve 10 puzzles', why: 'Daily tactics are the fastest way to stop missing threats.', done: (day.puzzle ?? 0) >= 10, href: '#/train' },
    { label: `10 “Is it safe?” checks (${Math.min(10, day.safety ?? 0)}/10)`, short: 'Do 10 “Is it safe?” checks', why: 'The few seconds’ check before every move keeps your pieces on the board.', done: (day.safety ?? 0) >= 10, href: '#/train/safe' },
    { label: 'One lesson, endgame drill or opening line', short: 'One lesson, drill or opening line', why: 'A little theory every day adds up.', done: (day.lesson ?? 0) + (day.drill ?? 0) + (day.opening ?? 0) > 0, href: '#/learn' },
    {
      label: 'Play a game, then review it',
      short: latestUnreviewedLoss ? `Review your loss vs ${latestUnreviewedLoss.game[latestUnreviewedLoss.color === 'w' ? 'black' : 'white'].username}` : 'Play a game, then review it',
      why: 'Every mistake in your own games becomes a puzzle for you.',
      done: (day.game ?? 0) > 0,
      href: latestUnreviewedLoss ? `#/games/${me}?game=${encodeURIComponent(latestUnreviewedLoss.game.url)}` : me ? `#/games/${me}` : '#/practice',
    },
    { label: 'Bonus: one board-vision run', short: 'One board-vision run', why: 'Knowing the squares instantly saves time in every game.', done: (day.vision ?? 0) > 0, href: '#/practice/vision' },
  ];
  const planDone = plan.filter((p) => p.done).length;
  const next = plan.find((p) => !p.done);

  // ── the road to 1500 ──
  const allStages = stages(lessons, drills);
  const mainRating = tiles[0] ? ratingOf(tiles[0]) : undefined;
  const current = mainRating ? Math.max(0, allStages.findIndex((st) => mainRating < st.range[1])) : 0;
  const nextStep = allStages[current]?.items.find((it) => it.done === false);

  // ── the clock and tilt coach ──
  // rapid is where thinking time pays: coach it whenever you play it; bullet is too fast to coach
  const clockClass = recentRapid ? 'rapid' : tiles[0] === 'bullet' ? null : (tiles[0] ?? null);
  const games = rows.map((r) => r.game);
  let clockDays = 7;
  let clock = me && clockClass ? clockSummary(games, me, clockClass, 7) : null;
  if (!clock && me && clockClass) {
    clock = clockSummary(games, me, clockClass, 30);
    clockDays = 30;
  }
  const tilt = me ? tiltCheck(games, me) : null;
  const habit = commonMistake();

  // ── what to work on: the few things that would gain the most ──
  const focus: Focus[] = [];
  if (latestUnreviewedLoss) {
    const r = latestUnreviewedLoss;
    focus.push({ icon: '🔎', title: 'Review your latest loss', why: `vs ${r.game[r.color === 'w' ? 'black' : 'white'].username} (${r.oppRating}), ${r.family}, ${ago(+r.date)}.`, href: `#/games/${me}?game=${encodeURIComponent(r.game.url)}`, action: 'Review game' });
  }
  if (habit && habit.count >= 2) focus.push({ icon: '📌', title: `Your most common mistake: ${habit.label.toLowerCase()}`, why: habit.rule, href: '#/train/safe', action: 'Practise' });
  if (clock && !clock.fastOk) focus.push({ icon: '⏱️', title: 'Slow down', why: `${clock.fastShare}% of your ${clockClass} moves take under 5 seconds, and you use ${clock.usedMin} of ${clock.baseMin} minutes.`, href: '#/train/safe', action: 'Is it safe?' });
  for (const x of recommendations(null, rows, openingStats(rows))) focus.push({ icon: x.title.startsWith('Fix') ? '♟️' : '⏱️', ...x });
  const byColor = overview(rows);
  if (byColor.white.n >= 8 && byColor.black.n >= 8 && Math.abs(scorePct(byColor.white) - scorePct(byColor.black)) >= 15) {
    const weak = scorePct(byColor.white) < scorePct(byColor.black) ? 'White' : 'Black';
    focus.push({ icon: '⚖️', title: `Shore up your ${weak} games`, why: `You score ${scorePct(byColor.white)}% as White and ${scorePct(byColor.black)}% as Black.`, href: '#/openings', action: `${weak} openings` });
  }
  if (due > 0) focus.push({ icon: '🔁', title: `${due} card${due > 1 ? 's' : ''} due in your daily review`, why: 'Recalling what you learned just before you’d forget it is what makes it stick.', href: '#/train/review', action: 'Review now' });
  if (nextStep) focus.push({ icon: '🧭', title: 'Next on your road to 1500', why: nextStep.label, href: nextStep.href, action: 'Start' });

  // ── skills ──
  const repertoire = quizLines(quizScope('repertoire').openings);
  const quiz = loadResults();
  const myPuzzles = load<{ id: string }[]>(KEYS.puzzles, []);
  const solved = load<Record<string, boolean>>(KEYS.puzzlesSolved, {});
  const skills = [
    { label: 'Lessons', done: lessons.length, total: ALL_LESSONS.length, href: '#/learn' },
    { label: 'Endgame drills', done: Object.keys(drills).length, total: DRILLS.length, href: '#/practice/drills' },
    { label: 'Repertoire lines (quiz)', done: repertoire.filter((l) => quiz[l.id]?.[ownColor(l)]?.passed).length, total: repertoire.length, href: '#/openings/quiz?scope=repertoire' },
    { label: 'Your mistakes solved', done: myPuzzles.filter((p) => solved[p.id]).length, total: myPuzzles.length, href: '#/train/mistakes' },
  ].filter((x) => x.total > 0);

  const chartSeries = series && (series === 'puzzles' || classes.includes(series)) ? series : (tiles[0] ?? 'puzzles');
  const chartData = chartSeries === 'puzzles' ? puzzle.history.map((h) => ({ x: h.t, y: h.r })) : historyOf(chartSeries);
  const name = account.user?.username ?? chess?.profile?.username ?? me;
  const loadingChess = !!me && !chess;

  return (
    <div className="dash">
      <header className="dash-head">
        <div>
          <div className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1>{greeting()}{name ? `, ${name}` : ''}</h1>
        </div>
        <div className="dash-head-side">
          <SyncBadge account={account} compact />
          {account.user && (
            <a className="head-avatar" href="#/account" aria-label="Your account">
              {chess?.profile?.avatar ? <img src={chess.profile.avatar} alt="" /> : account.user.username[0].toUpperCase()}
            </a>
          )}
        </div>
      </header>

      {account.status === 'signedOut' && !nudgeHidden && (
        <div className="nudge">
          <span className="nudge-icon">☁️</span>
          <div><b>Keep your progress on every device.</b> <span className="muted">Create a free account (no email) and your lessons, puzzles and ratings follow you between iPad, phone and laptop.</span></div>
          <div className="row">
            <button className="btn-green" onClick={() => navigate('account')}>Create account</button>
            <button className="btn-ghost" aria-label="Hide" onClick={() => { save(KEYS.me + '-nudge-hidden', true); setNudgeHidden(true); }}>✕</button>
          </div>
        </div>
      )}

      {tilt?.stop && (
        <div className="nudge tilt" role="status">
          <span className="nudge-icon">🧊</span>
          <div>
            <b>{tilt.streak} losses in a row. Time for a break.</b>{' '}
            <span className="muted">
              Take 15 minutes, or warm up with 10 “Is it safe?” checks before your next game.
              {tilt.afterLoss && tilt.afterWin ? ` Right after a loss you win ${tilt.afterLoss.winRate}% of your games; after a win, ${tilt.afterWin.winRate}%.` : ''}
            </span>
          </div>
          <div className="row">
            <a className="btn-secondary" href="#/train/safe">Warm up</a>
          </div>
        </div>
      )}

      <section className="next-up">
        <div className="next-main">
          <div className="eyebrow">{next ? 'Next up' : 'Today'}</div>
          <h2>{next ? next.short : 'All done for today 🎉'}</h2>
          <p>{next ? next.why : 'Great work. If you want more, a three-minute Puzzle Rush is a good finisher.'}</p>
          <a className="btn-green" href={next?.href ?? '#/train/rush'}>{next ? 'Continue →' : 'Puzzle Rush →'}</a>
        </div>
        <div className="next-side">
          <Ring done={planDone} total={plan.length} />
          <div>
            <div className="streak"><span aria-hidden="true">🔥</span> <b>{s}</b> day{s === 1 ? '' : 's'}</div>
            <div className="muted small">{s ? 'training streak' : 'Start a streak today'}</div>
          </div>
        </div>
      </section>

      <section className="kpis">
        {!me ? (
          <ConnectChessCom onSet={setMe} />
        ) : loadingChess ? (
          [0, 1].map((i) => <div key={i} className="kpi skel" />)
        ) : tiles.length ? (
          tiles.map((cls) => (
            <a key={cls} className="kpi" href={`#/games/${me}`}>
              <span className="kpi-label">{cls[0].toUpperCase() + cls.slice(1)}</span>
              <b className="kpi-value">{ratingOf(cls)}</b>
              <Delta n={deltaOf(cls, 30)} span="in 30 days" />
              <Spark values={historyOf(cls).map((p) => p.y)} />
            </a>
          ))
        ) : (
          <div className="kpi wide"><span className="kpi-label">chess.com</span><span className="muted small">No games in the last two months{chess?.profile ? '' : ' (or chess.com can’t be reached)'}.</span></div>
        )}
        <a className="kpi" href="#/train">
          <span className="kpi-label">Puzzles</span>
          <b className="kpi-value">{puzzle.rating}</b>
          {puzzle.games ? <Delta n={puzzleDelta} span="this week" /> : <span className="delta flat">not rated yet</span>}
          <Spark values={puzzle.history.slice(-40).map((h) => h.r)} />
        </a>
        {month.length > 0 && (
          <a className="kpi" href="#/insights">
            <span className="kpi-label">Last 30 days</span>
            <b className="kpi-value">{scorePct(rec)}%</b>
            <span className="muted small">{rec.w} won · {rec.d} drawn · {rec.l} lost</span>
            <div className="wdl-mini" aria-hidden="true">
              <span className="w" style={{ flexGrow: rec.w }} />
              <span className="d" style={{ flexGrow: rec.d }} />
              <span className="l" style={{ flexGrow: rec.l }} />
            </div>
          </a>
        )}
      </section>

      <div className="dash-grid">
        <div className="dash-col">
          <section className="panel p-chart">
            <div className="row-between">
              <h3>Rating trend</h3>
              <div className="seg mini" role="tablist">
                {[...classes, 'puzzles'].map((c) => (
                  <button key={c} role="tab" aria-selected={chartSeries === c} className={chartSeries === c ? 'on' : ''} onClick={() => setSeries(c)}>{c[0].toUpperCase() + c.slice(1)}</button>
                ))}
              </div>
            </div>
            {chartData.length >= 2 ? (
              <LineChart key={chartSeries} title={chartSeries === 'puzzles' ? 'Puzzle rating' : `${chartSeries[0].toUpperCase() + chartSeries.slice(1)} rating, last two months`} data={chartData} />
            ) : loadingChess && chartSeries !== 'puzzles' ? (
              <div className="skel chart-skel" />
            ) : (
              <div className="muted small empty-chart">{chartSeries === 'puzzles' ? 'Solve a few rated puzzles and your rating curve appears here.' : 'Not enough games yet.'}</div>
            )}
          </section>

          <section className="panel p-recent">
            <div className="row-between">
              <h3>Recent games</h3>
              {me && <a className="small" href={`#/games/${me}`}>All games →</a>}
            </div>
            {!me ? (
              <div className="muted small">Connect your chess.com username to see your games here.</div>
            ) : loadingChess ? (
              <div className="skel list-skel" />
            ) : rows.length === 0 ? (
              <div className="muted small">No games in the last two months.</div>
            ) : (
              <ul className="recent">
                {rows.slice(0, 6).map((r) => {
                  const opp = r.game[r.color === 'w' ? 'black' : 'white'];
                  const a = acc[r.game.url];
                  return (
                    <li key={r.game.url}>
                      <a href={`#/games/${me}?game=${encodeURIComponent(r.game.url)}`}>
                        <span className={`result ${r.outcome}`} aria-label={r.outcome}>{r.outcome === 'win' ? 'W' : r.outcome === 'loss' ? 'L' : 'D'}</span>
                        <span className="recent-main">
                          <b>{opp.username} <span className="muted">({opp.rating})</span></b>
                          <span className="muted small">{r.family} · {r.color === 'w' ? 'White' : 'Black'} · {r.timeClass} · {ago(+r.date)}</span>
                        </span>
                        <span className="recent-side">{a ? <><b>{Math.round(a[r.color === 'w' ? 0 : 1])}</b><span className="muted small">accuracy</span></> : <span className="review-cta">Review →</span>}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="panel p-activity">
            <div className="row-between">
              <h3>Activity</h3>
              <span className="muted small">last 12 weeks</span>
            </div>
            <Heatmap />
          </section>
        </div>

        <div className="dash-col">
          <section className="panel p-plan">
            <div className="row-between">
              <h3>Today’s training</h3>
              <span className="muted small">{planDone}/{plan.length} done</span>
            </div>
            <ul className="plan">
              {plan.map((p) => (
                <li key={p.label} className={p.done ? 'done' : ''}>
                  <span className="plan-check">{p.done ? '✓' : ''}</span>
                  <a href={p.href}>{p.label}</a>
                </li>
              ))}
            </ul>
          </section>

          {focus.length > 0 && (
            <section className="panel p-focus">
              <h3>What to work on</h3>
              <ul className="focus">
                {focus.slice(0, 3).map((f) => (
                  <li key={f.title}>
                    <span className="focus-icon" aria-hidden="true">{f.icon}</span>
                    <div>
                      <b>{f.title}</b>
                      <div className="muted small">{f.why}</div>
                    </div>
                    <a className="btn-secondary small-btn" href={f.href}>{f.action}</a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {clock && clockClass && <ClockCard clock={clock} timeClass={clockClass} days={clockDays} />}

          <section className="panel p-skills">
            <h3>Skills</h3>
            <ul className="skills">
              {skills.map((k) => (
                <li key={k.label}>
                  <a href={k.href}>
                    <span className="row-between"><span>{k.label}</span><b>{k.done}/{k.total}</b></span>
                    <span className="bar" role="progressbar" aria-valuenow={k.done} aria-valuemin={0} aria-valuemax={k.total} aria-label={k.label}><span style={{ width: `${(k.done / k.total) * 100}%` }} /></span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

        </div>
      </div>

      <section className="chapter">
        <div className="row-between">
          <h2>Your road to 1500</h2>
          {mainRating ? <span className="muted">Your {tiles[0]} rating: <b>{mainRating}</b></span> : loadingChess && <span className="muted small">Loading your rating…</span>}
        </div>
        <div className="road">
          {allStages.map((st, i) => {
            const status = mainRating && mainRating >= st.range[1] ? 'passed' : i === current ? 'current' : 'later';
            return (
              <div key={st.title} className={`stage ${status}`}>
                <div className="stage-head">
                  <span className="stage-num">{status === 'passed' ? '✓' : i + 1}</span>
                  <div>
                    <b>{st.title}</b>
                    <div className="muted small">{st.range[0] ? `${st.range[0]}–${st.range[1]}` : `Below ${st.range[1]}`}{status === 'current' ? ' · you are here' : ''}</div>
                  </div>
                </div>
                <p className="muted small">{st.focus}</p>
                <ul className="plan">
                  {st.items.map((it) => (
                    <li key={it.label} className={it.done ? 'done' : ''}>
                      <span className="plan-check">{it.done ? '✓' : ''}</span>
                      <a href={it.href}>{it.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className="cards">
        <button className="card" onClick={() => navigate('insights')}>
          <div className="card-title">📊 Weakness report</div>
          <div className="card-body">See exactly where your rating points go: hung pieces, time trouble, weak openings.</div>
        </button>
        <button className="card" onClick={() => navigate('train/rush')}>
          <div className="card-title">⚡ Puzzle Rush</div>
          <div className="card-body">Three minutes, three strikes. Great as a warm-up before you play.</div>
        </button>
        <button className="card" onClick={() => navigate('openings/quiz?scope=repertoire')}>
          <div className="card-title">🧪 Opening quiz</div>
          <div className="card-body">Play your repertoire from memory while the computer varies its lines.</div>
        </button>
        {STATIC_HOST && (
          <button className="card" onClick={() => navigate('offline')}>
            <div className="card-title">✈️ Study offline</div>
            <div className="card-body">Save the app, every puzzle and the master database on this device, then use them on a flight.</div>
          </button>
        )}
      </div>
    </div>
  );
}
