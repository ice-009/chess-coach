import { useEffect, useState } from 'react';
import { getPlayer, searchPlayers, topPlayers } from '../lib/masterDb';
import type { DbPlayer, Dossier, Score } from '../lib/masterDb';
import { navigate } from '../lib/router';
import { WdlBar } from '../components/WdlBar';
import { RatingChart } from '../components/RatingChart';
import { GameLine } from '../components/MasterExplorer';

const scorePct = (s: Score) => (s.n ? Math.round(((s.w + s.d / 2) / s.n) * 100) : 0);

function PlayerCard({ p }: { p: DbPlayer }) {
  return (
    <button className="card compact player-card" onClick={() => navigate(`database/player/${encodeURIComponent(p.key)}`)}>
      <div className="card-title">
        {p.title && <span className="title-badge sm">{p.title}</span>} {p.name}
      </div>
      <div className="muted small">
        {p.max_elo ? `Peak ${p.max_elo} · ` : ''}
        {p.otb_games.toLocaleString()} OTB games{p.games > p.otb_games ? ` (+${(p.games - p.otb_games).toLocaleString()} online)` : ''} · {p.first_year}–{p.last_year}
      </div>
    </button>
  );
}

export function DbPlayers() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<DbPlayer[] | null>(null);
  const [top, setTop] = useState<DbPlayer[]>([]);

  useEffect(() => {
    topPlayers().then(setTop, () => undefined);
  }, []);
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => searchPlayers(q, ctrl.signal).then(setResults, () => undefined), 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  return (
    <div>
      <input className="db-player-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a player: Carlsen, Kasparov, Gukesh…" aria-label="Search players" autoFocus />
      {results && (
        <div className="cards">
          {results.map((p) => <PlayerCard key={p.key} p={p} />)}
          {results.length === 0 && <div className="muted">No player matches “{q}”.</div>}
        </div>
      )}
      {!results && top.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 16 }}>Highest rated players in your database</div>
          <div className="cards">{top.map((p) => <PlayerCard key={p.key} p={p} />)}</div>
        </>
      )}
    </div>
  );
}

function RecordCard({ title, s }: { title: string; s: Score }) {
  return (
    <div className="record-card">
      <div className="row-between">
        <b>{title}</b>
        <span className="muted small">{s.n.toLocaleString()} games</span>
      </div>
      <div className="record-score">{scorePct(s)}%</div>
      <WdlBar w={s.w} d={s.d} b={s.l} labels={['Wins', 'Draws', 'Losses']} />
      <div className="muted small">+{s.w} ={s.d} −{s.l}</div>
    </div>
  );
}

function Repertoire({ title, rows, onPick }: { title: string; rows: Dossier['whiteRep']; onPick: (fam: string) => void }) {
  return (
    <div className="rep">
      <div className="section-title">{title}</div>
      <table className="mx-table">
        <thead>
          <tr>
            <th>Opening</th>
            <th className="num">Games</th>
            <th className="num">Score</th>
            <th className="wdl-col">Win / Draw / Loss</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.fam} onClick={() => onPick(r.fam)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onPick(r.fam)}>
              <td>{r.fam}</td>
              <td className="num">{r.n}</td>
              <td className="num">{scorePct(r)}%</td>
              <td className="wdl-col"><WdlBar w={r.w} d={r.d} b={r.l} labels={['Wins', 'Draws', 'Losses']} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="muted small">No games with this color.</div>}
    </div>
  );
}

export function DbPlayerDossier({ playerKey }: { playerKey: string }) {
  const [d, setD] = useState<Dossier | null>(null);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(false);
  useEffect(() => {
    getPlayer(playerKey, online).then(setD, (e) => setError((e as Error).message));
  }, [playerKey, online]);

  if (error) return <div className="error">{error}</div>;
  if (!d) return <div className="page-loading"><span className="spinner" /></div>;
  const p = d.player;
  const games = (extra: string) => navigate(`database/games?player=${encodeURIComponent(p.key)}&name=${encodeURIComponent(p.name)}${extra}`);

  return (
    <div className="dossier">
      <button className="btn-ghost" onClick={() => navigate('database/players')}>← Players</button>
      <div className="dossier-head">
        <div>
          <h1>{p.title && <span className="title-badge">{p.title}</span>} {p.name}</h1>
          <div className="muted">
            {p.max_elo ? `Peak rating ${p.max_elo} · ` : ''}
            {p.otb_games.toLocaleString()} over-the-board games{p.games > p.otb_games ? ` and ${(p.games - p.otb_games).toLocaleString()} online` : ''} · {p.first_year}–{p.last_year}
          </div>
        </div>
        <div className="row">
          {p.games > p.otb_games && (
            <div className="chips">
              <button className={`chip ${!online ? 'on' : ''}`} onClick={() => setOnline(false)}>Over the board</button>
              <button className={`chip ${online ? 'on' : ''}`} onClick={() => setOnline(true)}>+ Online</button>
            </div>
          )}
          <button className="btn-green" onClick={() => games('')}>All games →</button>
        </div>
      </div>

      <div className="record-grid">
        <RecordCard title="As White" s={d.asWhite} />
        <RecordCard title="As Black" s={d.asBlack} />
      </div>

      {d.ratings.length >= 2 && <RatingChart data={d.ratings} />}

      <div className="rep-grid">
        <Repertoire title="Repertoire with White" rows={d.whiteRep} onPick={(fam) => games(`&color=white&opening=${encodeURIComponent(fam)}`)} />
        <Repertoire title="Repertoire with Black" rows={d.blackRep} onPick={(fam) => games(`&color=black&opening=${encodeURIComponent(fam)}`)} />
      </div>

      <div className="rep-grid">
        <div>
          <div className="section-title">Best wins</div>
          {d.bestWins.map((g) => <GameLine key={g.id} g={g} onClick={() => navigate(`database/game/${g.id}`)} />)}
        </div>
        <div>
          <div className="section-title">Latest games</div>
          {d.recent.map((g) => <GameLine key={g.id} g={g} onClick={() => navigate(`database/game/${g.id}`)} />)}
        </div>
      </div>
    </div>
  );
}
