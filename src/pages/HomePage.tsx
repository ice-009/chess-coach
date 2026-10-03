import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ALL_LESSONS } from '../data/lessons';
import { DRILLS } from '../data/drills';
import { activityOn, recentDays, streak, today } from '../lib/activity';
import { dueReviews, getRating } from '../lib/puzzles';
import { getProfile } from '../lib/chesscom';
import { navigate } from '../lib/router';
import { KEYS, getMe, load, save } from '../lib/storage';

// activity strip: ordinal one-hue ramp, validated against the panel surface (all steps pass, light end 2.56:1)
const RAMP = ['#4d6b35', '#5f8a3c', '#76a845', '#97cc5c'];
const stepOf = (n: number) => (n >= 30 ? 3 : n >= 15 ? 2 : n >= 5 ? 1 : 0);

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

export function HomePage() {
  const [me, setMe] = useState(getMe);
  const [input, setInput] = useState(me);
  const [rating, setRating] = useState<{ label: string; rating: number } | null>(null);
  const day = activityOn(today());
  const due = dueReviews().length;
  const lessons = load<string[]>(KEYS.lessonsDone, []);
  const drills = load<Record<string, number>>(KEYS.drillsDone, {});
  const puzzle = getRating();
  const days = recentDays(14);
  const s = streak();

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    getProfile(me)
      .then((p) => {
        const r = p.ratings.find((x) => x.label === 'Rapid') ?? p.ratings.find((x) => x.label === 'Blitz') ?? p.ratings[0];
        if (!cancelled && r) setRating(r);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [me]);

  function saveMe(e: FormEvent) {
    e.preventDefault();
    const name = input.trim().toLowerCase();
    save(KEYS.me, name);
    setMe(name);
  }

  const plan = [
    { label: `Solve 10 puzzles (${Math.min(10, day.puzzle ?? 0)}/10)`, done: (day.puzzle ?? 0) >= 10, href: '#/train' },
    due > 0
      ? { label: `Clear your review queue (${due} due)`, done: false, href: '#/train/review' }
      : { label: 'Review queue clear', done: true, href: '#/train/review' },
    { label: 'One lesson, endgame drill or opening line', done: (day.lesson ?? 0) + (day.drill ?? 0) + (day.opening ?? 0) > 0, href: '#/learn' },
    { label: 'Play a game, then review it', done: (day.game ?? 0) > 0, href: me ? `#/games/${me}` : '#/practice' },
    { label: 'Bonus: one board-vision run', done: (day.vision ?? 0) > 0, href: '#/practice/vision' },
  ];
  const planDone = plan.filter((p) => p.done).length;

  const allStages = stages(lessons, drills);
  const current = rating ? allStages.findIndex((st) => rating.rating < st.range[1]) : 0;

  return (
    <div>
      <section className="hero">
        <h1>{me ? `Let’s get you to 1500, ${me}.` : 'Become a real chess player.'}</h1>
        <p>
          Short daily training beats long weekend sessions: puzzles every day, one lesson or drill, and one game you actually review.
        </p>
        {!me && (
          <form className="search" onSubmit={saveMe}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Your chess.com username" aria-label="Your chess.com username" />
            <button className="primary">Save</button>
          </form>
        )}
      </section>

      <div className="home-grid">
        <section className="panel">
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
        <section className="panel">
          <div className="row-between">
            <h3>🔥 {s}-day streak</h3>
            <span className="muted small">last 14 days</span>
          </div>
          <div className="strip" role="img" aria-label={days.map((d) => `${d.date}: ${d.total}`).join(', ')}>
            {days.map((d) => (
              <span key={d.date} className="strip-day" title={`${d.date}: ${d.total} training actions`} style={{ background: d.total ? RAMP[stepOf(d.total)] : 'var(--panel-3)' }} />
            ))}
          </div>
          <div className="strip-legend muted small">
            <span>Less</span>
            {RAMP.map((c) => <span key={c} className="strip-key" style={{ background: c }} />)}
            <span>More</span>
          </div>
          <div className="stats-row compact-stats">
            <a className="stat" href="#/train"><b>{puzzle.rating}</b><span>puzzle rating ({puzzle.games} played)</span></a>
            <a className="stat" href="#/learn"><b>{lessons.length}/{ALL_LESSONS.length}</b><span>lessons</span></a>
            <a className="stat" href="#/practice/drills"><b>{Object.keys(drills).length}/{DRILLS.length}</b><span>endgame drills</span></a>
          </div>
        </section>
      </div>

      <section className="chapter">
        <div className="row-between">
          <h2>Your road to 1500</h2>
          {rating ? (
            <span className="muted">Your {rating.label.toLowerCase()} rating: <b>{rating.rating}</b></span>
          ) : (
            me && <span className="muted small">Loading your rating…</span>
          )}
        </div>
        <div className="road">
          {allStages.map((st, i) => {
            const status = rating && rating.rating >= st.range[1] ? 'passed' : i === current ? 'current' : 'later';
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
        <button className="card" onClick={() => navigate('database')}>
          <div className="card-title">📚 Master database</div>
          <div className="card-body">See how grandmasters play your openings.</div>
        </button>
      </div>
    </div>
  );
}
