import { useEffect, useMemo, useState } from 'react';
import { CLASSICS, findClassic } from '../data/classics';
import type { ClassicGame } from '../data/classics';
import type { ParsedGame } from '../lib/analysis';
import { parseLine, sideToMove } from '../lib/chess';
import { navigate } from '../lib/router';
import { AnalysisView } from '../components/AnalysisView';
import { NavIcons } from '../components/icons';

const FEATURED: { username: string; name: string; note: string }[] = [
  { username: 'magnuscarlsen', name: 'Magnus Carlsen', note: 'World #1 for over a decade' },
  { username: 'hikaru', name: 'Hikaru Nakamura', note: 'Online blitz king' },
  { username: 'fabianocaruana', name: 'Fabiano Caruana', note: 'Deep opening preparation' },
  { username: 'gukeshdommaraju', name: 'Gukesh D', note: '18th World Champion' },
  { username: 'rpragchess', name: 'Praggnanandhaa R', note: 'Fearless attacking play' },
  { username: 'ghandeevam2003', name: 'Arjun Erigaisi', note: 'Creative and aggressive' },
  { username: 'firouzja2003', name: 'Alireza Firouzja', note: 'Speed and tactics' },
  { username: 'anishgiri', name: 'Anish Giri', note: 'Rock-solid technique' },
  { username: 'lachesisq', name: 'Ian Nepomniachtchi', note: 'Lightning-fast intuition' },
  { username: 'levonaronian', name: 'Levon Aronian', note: 'Imaginative ideas' },
  { username: 'danielnaroditsky', name: 'Daniel Naroditsky', note: 'Classic, instructive style' },
  { username: 'gothamchess', name: 'Levy Rozman (IM)', note: 'Club-level openings' },
];

const TITLES = ['GM', 'IM', 'FM', 'CM', 'NM', 'WGM', 'WIM', 'WFM'];

export function classicToParsed(g: ClassicGame): { parsed: ParsedGame; comments: (string | undefined)[] } {
  const nodes = parseLine(g.moves);
  return {
    parsed: {
      fens: [nodes[0].fenBefore, ...nodes.map((n) => n.fenAfter)],
      moves: nodes.map((n) => ({ san: n.san, uci: n.uci, from: n.from, to: n.to, color: sideToMove(n.fenBefore), captured: n.captured })),
    },
    comments: [undefined, ...nodes.map((n) => n.comment)],
  };
}

function ClassicView({ game }: { game: ClassicGame }) {
  const { parsed, comments } = useMemo(() => classicToParsed(game), [game]);
  return (
    <>
      <div className="lesson-intro">
        <div className="eyebrow">{game.event}, {game.year} · {game.result}</div>
        <p><b>What to learn:</b> {game.lesson}</p>
        <p className="muted small">Tip: before pressing ▶, guess the next move for the winning side. Comparing your guess with a master’s move is one of the best training methods there is.</p>
      </div>
      <AnalysisView
        cacheKey={`classic:${game.id}`}
        parsed={parsed}
        comments={comments}
        white={{ name: game.white }}
        black={{ name: game.black }}
        perspective={game.result === '0-1' ? 'b' : 'w'}
        result={game.result === '1/2-1/2' ? 'draw' : 'win'}
        showCoach={false}
        meta={{ opening: game.theme[0], timeControl: 'classical (over the board)' }}
        heading={game.title}
        onBack={() => navigate('masters')}
        backLabel="← Masters"
      />
    </>
  );
}

function TitledBrowser() {
  const [title, setTitle] = useState('GM');
  const [players, setPlayers] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setPlayers([]);
    setError('');
    fetch(`https://api.chess.com/pub/titled/${title}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`chess.com API error (${r.status})`))))
      .then((d) => !cancelled && setPlayers(d.players as string[]))
      .catch((e) => !cancelled && setError(String(e.message ?? e)));
    return () => {
      cancelled = true;
    };
  }, [title]);

  const q = query.trim().toLowerCase();
  const matches = players.filter((p) => p.includes(q)).slice(0, 60);

  return (
    <div>
      <div className="filters">
        <select value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title">
          {TITLES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search usernames…" aria-label="Search usernames" />
        <span className="muted small">{players.length ? `${players.length} ${title}s on chess.com` : error || 'Loading…'}</span>
      </div>
      <div className="chips">
        {matches.map((p) => (
          <button key={p} className="chip" onClick={() => navigate(`games/${p}`)}>{p}</button>
        ))}
        {players.length > 0 && matches.length === 0 && <span className="muted">No usernames match.</span>}
      </div>
      {players.length > 60 && matches.length === 60 && <div className="muted small">Showing the first 60. Type to search.</div>}
    </div>
  );
}

export function MastersPage({ classicId }: { classicId?: string }) {
  if (classicId) {
    const g = findClassic(classicId);
    return g ? <ClassicView game={g} /> : <div className="error">Game not found.</div>;
  }
  return (
    <div>
      <h1>Masters</h1>
      <p className="muted">Learn from the best. Play through the most famous games ever, with notes, or open the live games of any titled player on chess.com and analyse them with Stockfish.</p>

      <button className="db-banner" onClick={() => navigate('database')}>
        <span className="db-banner-icon">{NavIcons.database}</span>
        <span>
          <b>Master Database</b>
          <span className="muted">Opening explorer, game search and player dossiers over real over-the-board master games, ChessBase-style.</span>
        </span>
        <span className="teaser-more">Open →</span>
      </button>

      <section className="chapter">
        <h2>Immortal classics</h2>
        <div className="cards">
          {CLASSICS.map((g) => (
            <button key={g.id} className="card" onClick={() => navigate(`masters/classic/${g.id}`)}>
              <div className="card-title">{g.title}</div>
              <div className="muted small">{g.white} – {g.black} · {g.year} · {g.result}</div>
              <div className="card-body">{g.lesson}</div>
              <div className="chips small">{g.theme.map((t) => <span key={t} className="tag">{t}</span>)}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="chapter">
        <h2>Today’s elite on chess.com</h2>
        <div className="cards">
          {FEATURED.map((p) => (
            <button key={p.username} className="card compact" onClick={() => navigate(`games/${p.username}`)}>
              <div className="card-title">{p.name}</div>
              <div className="muted small">@{p.username} · {p.note}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="chapter">
        <h2>Every titled player</h2>
        <p className="muted">Browse all GMs, IMs, FMs and more with a chess.com account. Click a name to see and analyse their games.</p>
        <TitledBrowser />
      </section>
    </div>
  );
}
