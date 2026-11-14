import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { getArchives, getGames } from '../lib/chesscom';
import type { ChessComGame } from '../lib/chesscom';
import type { GameAnalysis } from '../lib/analysis';
import { DEEP_DEPTH, loadCached, parseGame } from '../lib/analysis';
import { coachReport } from '../lib/coach';
import { aggregate, endings, gameRows, openingStats, overview, recommendations, scorePct } from '../lib/insights';
import type { AnalyzedGame, GameRow } from '../lib/insights';
import { enqueue, onAnalysed, stop, useBgAnalysis } from '../lib/bgAnalysis';
import { PHASES, accuracyByResult, blunderPieces, byHour, byLength, byOpponent, byTimeControl, byWeekday, conversion, phaseAccuracy, spread, themeSuccess, timePerMove } from '../lib/advancedStats';
import type { Bucket, ThemeResults } from '../lib/advancedStats';
import { KEYS, getMe, load, save } from '../lib/storage';
import { ENDGAME_THEMES, MATE_THEMES, THEMES, getRating, themeLabel } from '../lib/puzzles';
import { navigate } from '../lib/router';
import { WdlBar } from '../components/WdlBar';
import { BarList } from '../components/BarList';
import { LineChart } from '../components/LineChart';

// per-game coach reports survive navigation (they only depend on the game and its analysis)
const REPORTS = new Map<string, Omit<AnalyzedGame, 'row'>>();

const CLASSES = [
  { id: 'all', label: 'All games' },
  { id: 'rapid', label: 'Rapid' },
  { id: 'blitz', label: 'Blitz' },
  { id: 'bullet', label: 'Bullet' },
];

function SetUser({ onSet }: { onSet: (u: string) => void }) {
  const [v, setV] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = v.trim().toLowerCase();
    if (!name) return;
    save(KEYS.me, name);
    onSet(name);
  };
  return (
    <form className="db-setup" onSubmit={submit}>
      <h2>Whose games should I look at?</h2>
      <p className="muted">Enter your chess.com username. The report uses your last three months of games.</p>
      <div className="search-bar">
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="chess.com username" aria-label="chess.com username" />
        <button className="btn-green">Build my report</button>
      </div>
    </form>
  );
}

const DAY_NAME: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

/** Where to train a theme: the endgame and mate sections have their own theme rows. */
const themeRoute = (t: string) =>
  THEMES.some((x) => x.key === t) ? `train/theme/${t}` : ENDGAME_THEMES.some((x) => x.key === t) ? `train/endgames/${t}` : MATE_THEMES.some((x) => x.key === t) ? `train/mates/${t}` : `train/theme/${t}`;

/** Your puzzle rating over time and your success rate in each theme, weakest first. */
function PuzzleStats() {
  const [rating] = useState(getRating);
  const [themes] = useState(() => themeSuccess(load<ThemeResults>(KEYS.themeResults, {})));
  const shown = themes.slice(0, 10);
  return (
    <section className="chapter">
      <h2>Puzzles</h2>
      {rating.history.length >= 2 ? (
        <LineChart title={`Your puzzle rating (${rating.games} rated puzzle${rating.games === 1 ? '' : 's'})`} data={rating.history.map((h) => ({ x: h.t, y: h.r }))} />
      ) : (
        <p className="muted">Your puzzle rating chart appears after a couple of <a href="#/train">rated puzzles</a>.</p>
      )}
      {shown.length > 0 ? (
        <figure className="bar-list theme-rates">
          <figcaption>Success rate by theme, weakest first</figcaption>
          {shown.map((t) => (
            <div key={t.theme} className="bar-row" tabIndex={0} title={`${themeLabel(t.theme)}: ${t.ok} of ${t.n} solved`}>
              <span className="bar-label">{themeLabel(t.theme)}</span>
              <span className="bar-track">
                <span className={`bar-fill ${t.pct < 50 ? 'weak' : t.pct < 70 ? 'mid' : ''}`} style={{ width: `${Math.max(t.pct, 1)}%` }} />
                <span className="bar-value">{t.pct}%</span>
                <span className="muted small">{t.ok}/{t.n}</span>
                <a className="small theme-train" href={`#/${themeRoute(t.theme)}`}>Train →</a>
              </span>
            </div>
          ))}
          {themes.length > shown.length && <div className="muted small">and {themes.length - shown.length} stronger theme{themes.length - shown.length === 1 ? '' : 's'}</div>}
        </figure>
      ) : (
        <p className="muted small">Per-theme success rates show up once you’ve tried 3 or more rated puzzles in a theme.</p>
      )}
    </section>
  );
}

/** Accuracy as a ring: green when strong, gold in the middle, red when weak. */
function Gauge({ value }: { value: number | null }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const v = value ?? 0;
  const color = value === null ? 'var(--panel-3)' : v >= 80 ? 'var(--green)' : v >= 65 ? 'var(--gold)' : 'var(--red)';
  return (
    <svg className="gauge" viewBox="0 0 76 76" role="img" aria-label={value === null ? 'not enough moves' : `${v.toFixed(1)} accuracy`}>
      <circle cx="38" cy="38" r={r} className="ring-bg" />
      <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 38 38)" />
      <text x="38" y="43" textAnchor="middle">{value === null ? '–' : v.toFixed(0)}</text>
    </svg>
  );
}

export function InsightsPage() {
  const [user, setUser] = useState(getMe);
  const [games, setGames] = useState<ChessComGame[] | null>(null);
  const [error, setError] = useState('');
  const [cls, setCls] = useState('all');
  const bg = useBgAnalysis();
  const batch = bg.running ? bg : null;
  const [cache, setCache] = useState<Record<string, GameAnalysis>>({}); // finished analyses by game url
  useEffect(() => onAnalysed((url, a) => setCache((prev) => ({ ...prev, [url]: a }))), []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setGames(null);
    setError('');
    (async () => {
      try {
        const arcs = await getArchives(user);
        const all: ChessComGame[] = [];
        for (const url of arcs.slice(0, 3)) all.push(...(await getGames(url)));
        if (!cancelled) setGames(all);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // daily games only count in the time-control comparison; everything else is about games on the clock
  const allRows = useMemo(() => (games && user ? gameRows(games, user) : []), [games, user]);
  const rows = useMemo(() => allRows.filter((r) => r.timeClass !== 'daily' && (cls === 'all' || r.timeClass === cls)), [allRows, cls]);
  // pick up games already analysed earlier (in Game Review or a previous batch)
  useEffect(() => {
    const found: Record<string, GameAnalysis> = {};
    for (const r of allRows) {
      const a = loadCached(r.game.url, DEEP_DEPTH);
      if (a) found[r.game.url] = a;
    }
    setCache((c) => ({ ...found, ...c }));
  }, [allRows]);
  // coach reports are computed once per game, in small time slices, so the page never freezes
  const [reports, setReports] = useState<Record<string, Omit<AnalyzedGame, 'row'>>>({});
  useEffect(() => {
    let cancelled = false;
    const pending = rows.filter((r) => cache[r.game.url] && !REPORTS.has(r.game.url));
    let i = 0;
    const work = () => {
      const t0 = performance.now();
      while (i < pending.length && performance.now() - t0 < 25) {
        const row = pending[i++];
        const analysis = cache[row.game.url];
        const parsed = parseGame(row.game.pgn);
        REPORTS.set(row.game.url, { parsed, analysis, report: coachReport(parsed, analysis, row.color, row.outcome) });
      }
      if (cancelled) return;
      setReports(Object.fromEntries(REPORTS));
      if (i < pending.length) window.setTimeout(work, 0);
    };
    work();
    return () => {
      cancelled = true;
    };
  }, [rows, cache]);
  const analyzed = useMemo<AnalyzedGame[]>(() => rows.flatMap((row) => (reports[row.game.url] ? [{ row, ...reports[row.game.url] }] : [])), [rows, reports]);
  const agg = useMemo(() => (analyzed.length ? aggregate(analyzed) : null), [analyzed]);
  const ov = useMemo(() => overview(rows), [rows]);
  const ends = useMemo(() => endings(rows), [rows]);
  const opens = useMemo(() => openingStats(rows), [rows]);
  const recs = useMemo(() => recommendations(agg, rows, opens), [agg, rows, opens]);

  // rating history for the most-played time control in view
  const ratingSeries = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => counts.set(r.timeClass, (counts.get(r.timeClass) ?? 0) + 1));
    const main = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return { main, data: rows.filter((r) => r.timeClass === main).map((r) => ({ x: +r.date, y: r.myRating })).sort((a, b) => a.x - b.x) };
  }, [rows]);

  /** Queues your latest n games (all of them when n is Infinity) that aren't analysed yet; it keeps going if you leave the page. */
  function analyzeRecent(n: number) {
    const todo: GameRow[] = [...rows].sort((a, b) => +b.date - +a.date).slice(0, n).filter((r) => !cache[r.game.url]);
    enqueue(todo.map((r) => ({ url: r.game.url, pgn: r.game.pgn, color: r.color, date: +r.date, label: `vs ${r.color === 'w' ? r.game.black.username : r.game.white.username}` })));
  }
  const unanalysed = rows.filter((r) => !cache[r.game.url]).length;

  // advanced stats
  const phases = useMemo(() => phaseAccuracy(analyzed), [analyzed]);
  const conv = useMemo(() => conversion(analyzed), [analyzed]);
  const vsOpp = useMemo(() => byOpponent(rows), [rows]);
  const days = useMemo(() => byWeekday(rows), [rows]);
  const hours = useMemo(() => byHour(rows), [rows]);
  const lengths = useMemo(() => byLength(rows), [rows]);
  const pieces = useMemo(() => blunderPieces(analyzed), [analyzed]);
  const accRes = useMemo(() => accuracyByResult(analyzed), [analyzed]);
  const clockUse = useMemo(() => timePerMove(rows), [rows]);
  const controls = useMemo(() => byTimeControl(allRows, (r) => cache[r.game.url]?.accuracy[r.color]), [allRows, cache]);
  const scoreRows = (bs: Bucket[]) => bs.map((b) => ({ label: b.label, value: b.score, note: `${b.n} games: +${b.w} =${b.d} −${b.l}` }));
  const dayNote = spread(days);
  const hourNote = spread(hours);

  if (!user) return <SetUser onSet={setUser} />;

  return (
    <div className="insights">
      <div className="page-head row-between">
        <div>
          <h1>Insights</h1>
          <p className="muted">
            {user} · last 3 months · {rows.length} games{' '}
            <button className="link" onClick={() => setUser('')}>change player</button>
          </p>
        </div>
      </div>

      <div className="chips filters-row">
        {CLASSES.map((c) => (
          <button key={c.id} className={`chip ${cls === c.id ? 'on' : ''}`} onClick={() => setCls(c.id)}>{c.label}</button>
        ))}
      </div>

      {error && <div className="error">{error}</div>}
      {!games && !error && <div className="page-loading"><span className="spinner" /></div>}

      {games && (
        <>
          {/* what to do about it, first */}
          <section className="chapter">
            <h2>What to work on</h2>
            {recs.length === 0 ? (
              <p className="muted">{analyzed.length ? 'No clear weakness stands out. Keep training puzzles daily!' : 'Analyse your recent games below to get personal recommendations.'}</p>
            ) : (
              <div className="cards fill">
                {recs.map((r, i) => (
                  <a key={r.title} className="card rec-card" href={r.href}>
                    <span className="rec-rank">{i + 1}</span>
                    <div className="card-title">{r.title}</div>
                    <div className="card-body">{r.why}</div>
                    <span className="teaser-more">{r.action} →</span>
                  </a>
                ))}
              </div>
            )}
          </section>

          <div className="stats-row">
            <div className="stat"><b>{ov.all.n}</b><span>games</span></div>
            <div className="stat"><b>{scorePct(ov.all)}%</b><span>score (+{ov.all.w} ={ov.all.d} −{ov.all.l})</span></div>
            <div className="stat"><b>{agg ? agg.avgAccuracy.toFixed(1) : '–'}</b><span>average accuracy{agg ? ` (${agg.games} analysed)` : ''}</span></div>
            <div className="stat"><b>{agg ? agg.avgGameRating : '–'}</b><span>average game rating ≈</span></div>
            <div className="stat"><b>{agg ? agg.blundersPerGame.toFixed(1) : '–'}</b><span>blunders per game</span></div>
          </div>

          {ratingSeries.data.length >= 2 && <LineChart title={`Your ${ratingSeries.main} rating`} data={ratingSeries.data} />}

          <section className="chapter">
            <div className="row-between">
              <h2>Why you lose points</h2>
              {!batch && (
                <span className="row">
                  <button className="btn-secondary" onClick={() => analyzeRecent(10)}>Analyse last 10 games</button>
                  <button className="btn-secondary" onClick={() => analyzeRecent(25)}>Last 25</button>
                  {unanalysed > 0 && <button className="btn-green" onClick={() => analyzeRecent(Infinity)}>Analyse all {unanalysed}</button>}
                </span>
              )}
            </div>
            {batch && (
              <div className="build-progress panel">
                <div className="row-between">
                  <b>Analysing game {batch.done + 1} of {batch.total} ({batch.label})</b>
                  <button className="btn-secondary" onClick={stop}>Stop</button>
                </div>
                <div className="progress big"><div style={{ width: `${(batch.done / batch.total) * 100}%`, transform: 'none' }} /></div>
                <div className="muted small">Each game takes a few seconds. It keeps running while you use the rest of the app, and your mistakes become puzzles in the Puzzles tab.</div>
              </div>
            )}
            {agg ? (
              <>
                <p className="muted">
                  From {agg.games} analysed game{agg.games > 1 ? 's' : ''}: {agg.errorsPerGame.toFixed(1)} mistakes, misses or blunders per game.
                </p>
                <div className="insight-grid">
                  <BarList title="What went wrong" rows={agg.byCause.map((c) => ({ label: c.label, value: c.count }))} />
                  <BarList title="How long you thought" rows={agg.byTime.map((c) => ({ label: c.label, value: c.count }))} />
                  <BarList title="When it happened" rows={agg.byPhase.map((c) => ({ label: c.label, value: c.count }))} />
                </div>
                {agg.accuracy.length >= 2 && (
                  <LineChart
                    title="Accuracy per game (oldest to newest)"
                    data={agg.accuracy.map((a, i) => ({ x: i + 1, y: a.value }))}
                    decimals={1}
                    xFormat={(x) => `Game ${x}`}
                  />
                )}
              </>
            ) : (
              !batch && <p className="muted">Nothing analysed yet. Click a button above: Stockfish reviews each game and the coach explains every mistake.</p>
            )}
          </section>

          {controls.length > 1 && (
            <section className="chapter">
              <h2>By time control</h2>
              <div className="phase-row tc-row">
                {controls.map((c) => {
                  const id = c.label.toLowerCase();
                  const pick = id !== 'daily' && CLASSES.some((x) => x.id === id);
                  return (
                    <button key={c.label} className={`phase-card panel tc-card ${cls === id ? 'on' : ''}`} disabled={!pick} title={pick ? `Show only ${id} games` : undefined} onClick={() => setCls(cls === id ? 'all' : id)}>
                      <Gauge value={c.accuracy} />
                      <div>
                        <b className="phase-name">{c.label}</b>
                        <div className="small"><b>{c.score}%</b> score · +{c.w} ={c.d} −{c.l}</div>
                        <div className="muted small">{c.n} game{c.n === 1 ? '' : 's'}{c.analysed ? ` · accuracy from ${c.analysed} analysed` : ' · none analysed'}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {agg && (
            <section className="chapter">
              <h2>Accuracy by phase</h2>
              <div className="phase-row">
                {PHASES.map((p) => {
                  const v = phases[p].accuracy;
                  const worst = PHASES.filter((q) => phases[q].accuracy !== null).sort((a, b) => phases[a].accuracy! - phases[b].accuracy!)[0];
                  return (
                    <div key={p} className={`phase-card panel ${p === worst && v !== null ? 'weak' : ''}`}>
                      <Gauge value={v} />
                      <div>
                        <b className="phase-name">{p[0].toUpperCase() + p.slice(1)}</b>
                        <div className="muted small">{phases[p].games} game{phases[p].games === 1 ? '' : 's'}{p === worst && v !== null ? ' · your weakest phase' : ''}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="stats-row">
                <div className="stat tile-good">
                  <b>{conv.convertPct === null ? '–' : `${conv.convertPct}%`}</b>
                  <span>won positions converted ({conv.converted} of {conv.winning} games where you were clearly winning)</span>
                </div>
                <div className="stat tile-warn">
                  <b>{conv.savePct === null ? '–' : `${conv.savePct}%`}</b>
                  <span>lost positions saved ({conv.saved} of {conv.losing} games where you were clearly losing)</span>
                </div>
                {accRes.map((a) => (
                  <div className="stat" key={a.label}><b>{a.value.toFixed(1)}</b><span>accuracy in your {a.label.toLowerCase()} ({a.n})</span></div>
                ))}
              </div>
              {pieces.length > 0 && (
                <div className="insight-grid two">
                  <BarList title="The piece you moved when you blundered" rows={pieces} />
                  {clockUse.length > 0 && <BarList title="Seconds per move, by stretch of the game" rows={clockUse.map((c) => ({ label: c.label, value: Math.round(c.value * 10) / 10, note: `${c.n} moves` }))} />}
                </div>
              )}
            </section>
          )}

          <section className="chapter">
            <h2>Who, when and how long</h2>
            <div className="insight-grid">
              <BarList title="Score vs opponents rated…" rows={scoreRows(vsOpp)} format={(v) => `${v}%`} />
              <BarList title="Score by day of the week" rows={scoreRows(days)} format={(v) => `${v}%`} />
              <BarList title="Score by time of day" rows={scoreRows(hours)} format={(v) => `${v}%`} />
            </div>
            {(dayNote || hourNote) && (
              <div className="note">
                {dayNote && <>You score <b>{dayNote.best.score}%</b> on {DAY_NAME[dayNote.best.label]}s but <b>{dayNote.worst.score}%</b> on {DAY_NAME[dayNote.worst.label]}s. </>}
                {hourNote && <>Your best time is the <b>{hourNote.best.label.split(' ')[0].toLowerCase()}</b> ({hourNote.best.score}%), your worst the <b>{hourNote.worst.label.split(' ')[0].toLowerCase()}</b> ({hourNote.worst.score}%).</>}
              </div>
            )}
            <div className="insight-grid two">
              <BarList title="Score by game length" rows={scoreRows(lengths)} format={(v) => `${v}%`} />
              {!agg && clockUse.length > 0 && <BarList title="Seconds per move, by stretch of the game" rows={clockUse.map((c) => ({ label: c.label, value: Math.round(c.value * 10) / 10, note: `${c.n} moves` }))} />}
            </div>
          </section>

          <section className="chapter">
            <h2>Your openings</h2>
            <div className="rep-grid">
              {(['w', 'b'] as const).map((c) => (
                <div className="rep" key={c}>
                  <div className="section-title">As {c === 'w' ? 'White' : 'Black'} · {scorePct(c === 'w' ? ov.white : ov.black)}% score</div>
                  <table className="mx-table">
                    <thead>
                      <tr><th>Opening</th><th className="num">Games</th><th className="num">Score</th><th className="wdl-col">Win / Draw / Loss</th></tr>
                    </thead>
                    <tbody>
                      {opens.filter((o) => o.color === c).slice(0, 8).map((o) => (
                        <tr key={o.family} className={o.n >= 4 && o.score < 40 ? 'weak-row' : ''}>
                          <td>
                            {o.family}{' '}
                            <a className="small" href={`#/database?line=${encodeURIComponent(o.line.join(','))}`} title="Open the master database at the line you played" onClick={(e) => e.stopPropagation()}>
                              masters ↗
                            </a>
                          </td>
                          <td className="num">{o.n}</td>
                          <td className="num">{o.score}%</td>
                          <td className="wdl-col"><WdlBar w={o.w} d={o.d} b={o.l} labels={['Wins', 'Draws', 'Losses']} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
            <p className="muted small">Rows in red: 4+ games and under 40%. Study the matching line in <a href="#/openings">Openings</a>.</p>
          </section>

          <section className="chapter">
            <h2>How your games end</h2>
            <div className="insight-grid two">
              <BarList title="Your losses" rows={ends.losses.map((e) => ({ label: e.label, value: e.n }))} />
              <BarList title="Your wins" rows={ends.wins.map((e) => ({ label: e.label, value: e.n }))} />
            </div>
          </section>

          <p className="muted small">
            Want details on one game? Open it in <button className="link" onClick={() => navigate(`games/${user}`)}>Game Review</button>.
          </p>
        </>
      )}

      <PuzzleStats />
    </div>
  );
}
