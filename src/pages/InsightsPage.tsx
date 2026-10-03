import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { getArchives, getGames } from '../lib/chesscom';
import type { ChessComGame } from '../lib/chesscom';
import type { GameAnalysis } from '../lib/analysis';
import { DEEP_DEPTH, analyzeGame, loadCached, parseGame, saveCached, savePuzzlesFrom } from '../lib/analysis';
import { coachReport } from '../lib/coach';
import { aggregate, endings, gameRows, openingStats, overview, recommendations, scorePct } from '../lib/insights';
import type { AnalyzedGame, GameRow } from '../lib/insights';
import { logActivity } from '../lib/activity';
import { warmUpPool } from '../lib/engine';
import { KEYS, getMe, save } from '../lib/storage';
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

export function InsightsPage() {
  const [user, setUser] = useState(getMe);
  const [games, setGames] = useState<ChessComGame[] | null>(null);
  const [error, setError] = useState('');
  const [cls, setCls] = useState('all');
  const [batch, setBatch] = useState<{ done: number; total: number; label: string } | null>(null);
  const [cache, setCache] = useState<Record<string, GameAnalysis>>({}); // finished analyses by game url
  const ctrl = useRef<AbortController | null>(null);

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
        if (!cancelled) setGames(all.filter((g) => g.time_class !== 'daily'));
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      ctrl.current?.abort();
    };
  }, [user]);

  const rows = useMemo(() => (games && user ? gameRows(games, user).filter((r) => cls === 'all' || r.timeClass === cls) : []), [games, user, cls]);
  // pick up games already analysed earlier (in Game Review or a previous batch)
  useEffect(() => {
    const found: Record<string, GameAnalysis> = {};
    for (const r of rows) {
      const a = loadCached(r.game.url, DEEP_DEPTH);
      if (a) found[r.game.url] = a;
    }
    setCache((c) => ({ ...found, ...c }));
  }, [rows]);
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

  async function analyzeRecent(n: number) {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    warmUpPool();
    const todo: GameRow[] = [...rows].sort((a, b) => +b.date - +a.date).slice(0, n).filter((r) => !cache[r.game.url]);
    for (let i = 0; i < todo.length && !c.signal.aborted; i++) {
      const r = todo[i];
      setBatch({ done: i, total: todo.length, label: `vs ${r.color === 'w' ? r.game.black.username : r.game.white.username}` });
      const parsed = parseGame(r.game.pgn);
      const a = await analyzeGame(parsed, () => undefined, c.signal);
      if (!a || c.signal.aborted) break;
      saveCached(r.game.url, a);
      savePuzzlesFrom(parsed, a, r.color, r.game.url, +r.date);
      logActivity('game');
      setCache((prev) => ({ ...prev, [r.game.url]: a }));
    }
    setBatch(null);
  }

  if (!user) return <SetUser onSet={setUser} />;

  return (
    <div className="insights">
      <div className="page-head row-between">
        <div>
          <h1>Weakness report</h1>
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
              <div className="cards">
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
                  <button className="btn-green" onClick={() => analyzeRecent(25)}>Analyse last 25</button>
                </span>
              )}
            </div>
            {batch && (
              <div className="build-progress panel">
                <div className="row-between">
                  <b>Analysing game {batch.done + 1} of {batch.total} ({batch.label})</b>
                  <button className="btn-secondary" onClick={() => ctrl.current?.abort()}>Stop</button>
                </div>
                <div className="progress big"><div style={{ width: `${(batch.done / batch.total) * 100}%`, transform: 'none' }} /></div>
                <div className="muted small">Each game takes a few seconds. Your mistakes also become puzzles in the Puzzles tab.</div>
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
    </div>
  );
}
