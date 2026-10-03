import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { getArchives, getGames, getProfile, summarize } from '../lib/chesscom';
import type { ChessComGame, Profile } from '../lib/chesscom';
import { parseGame, savePuzzlesFrom } from '../lib/analysis';
import { navigate } from '../lib/router';
import { warmUpPool } from '../lib/engine';
import { KEYS, getMe, save } from '../lib/storage';
import { GameList } from '../components/GameList';
import { AnalysisView } from '../components/AnalysisView';

function GameReview({ game, user, onBack }: { game: ChessComGame; user: string; onBack: () => void }) {
  const parsed = useMemo(() => parseGame(game.pgn), [game.pgn]);
  const perspective = game.black.username.toLowerCase() === user.toLowerCase() ? 'b' : 'w';
  const isMe = user.toLowerCase() === getMe().toLowerCase();
  const info = useMemo(() => summarize(game, user), [game, user]);
  const tc = game.time_control.split('+');
  const timeControl = game.time_class === 'daily' ? 'daily' : `${game.time_class} ${Number(tc[0]) / 60}+${tc[1] ?? 0}`;
  return (
    <AnalysisView
      cacheKey={game.url}
      parsed={parsed}
      white={{ name: game.white.username, rating: game.white.rating }}
      black={{ name: game.black.username, rating: game.black.rating }}
      perspective={perspective}
      result={info.outcome}
      meta={{ opening: info.opening, timeControl }}
      onBack={onBack}
      backLabel="← Back to games"
      onAnalyzed={(a) => {
        if (isMe) savePuzzlesFrom(parsed, a, perspective, game.url, game.end_time * 1000);
      }}
    />
  );
}

export function GamesPage({ username }: { username?: string }) {
  const [input, setInput] = useState(username ?? getMe());
  const [archives, setArchives] = useState<string[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);
  const [games, setGames] = useState<ChessComGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ChessComGame | null>(null);
  const [me, setMe] = useState(getMe);
  const [profile, setProfile] = useState<Profile | null>(null);

  async function fetchMonths(urls: string[]) {
    const all: ChessComGame[] = [];
    for (const url of urls) all.push(...(await getGames(url)));
    return all;
  }

  // start the review engines now, so opening a game starts analysing instantly
  useEffect(() => warmUpPool(), []);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    setInput(username);
    setLoading(true);
    setError('');
    setGames([]);
    setSelected(null);
    getProfile(username).then((p) => !cancelled && setProfile(p)).catch(() => undefined);
    (async () => {
      try {
        const arcs = await getArchives(username);
        const first = arcs.slice(0, 2);
        const g = await fetchMonths(first);
        if (cancelled) return;
        setGames(g);
        setArchives(arcs);
        setLoadedCount(first.length);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const name = input.trim().toLowerCase();
    if (!name) return;
    if (!me) setAsMe(name); // first username entered becomes "you"
    navigate(`games/${name}`);
  }

  async function loadMore() {
    const next = archives.slice(loadedCount, loadedCount + 3);
    setLoading(true);
    try {
      const more = await fetchMonths(next);
      setGames((g) => [...g, ...more]);
      setLoadedCount((c) => c + next.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function setAsMe(name: string) {
    save(KEYS.me, name);
    setMe(name);
  }

  const isMe = !!username && username.toLowerCase() === me.toLowerCase();

  return (
    <>
      {selected && username && <GameReview game={selected} user={username} onBack={() => setSelected(null)} />}
      <div hidden={!!selected}>
        <div className="page-head">
          <h1>Game Review</h1>
          <p className="muted">Load anyone’s chess.com games, yours or a grandmaster’s, and get a full Stockfish review of each one.</p>
        </div>
        <form className="search-bar" onSubmit={submit}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter a chess.com username" aria-label="chess.com username" />
          <button className="btn-green" disabled={loading}>{loading ? 'Loading…' : 'Search'}</button>
          {me && !isMe && <button type="button" className="btn-secondary" onClick={() => navigate(`games/${me}`)}>My games</button>}
        </form>

        {username && profile && (
          <div className="profile-card">
            {profile.avatar ? <img className="profile-avatar" src={profile.avatar} alt="" /> : <span className="profile-avatar placeholder">{profile.username[0]?.toUpperCase()}</span>}
            <div className="profile-main">
              <div className="profile-name">
                {profile.title && <span className="title-badge">{profile.title}</span>}
                <b>{profile.username}</b>
                {profile.country && <span className="muted small">{profile.country}</span>}
              </div>
              {profile.name && <div className="muted">{profile.name}</div>}
              <div className="profile-ratings">
                {profile.ratings.map((r) => (
                  <span key={r.label} className="rating-pill"><span className="muted">{r.label}</span> <b>{r.rating}</b></span>
                ))}
              </div>
            </div>
            <div className="profile-side">
              {isMe ? (
                <span className="me-tag">✓ You · mistakes become <a href="#/train">puzzles</a></span>
              ) : (
                <button className="btn-secondary" onClick={() => setAsMe(username.toLowerCase())}>This is me</button>
              )}
            </div>
          </div>
        )}

        {error && <div className="error">{error}</div>}
        {username && loading && games.length === 0 && <div className="page-loading"><span className="spinner" /></div>}
        {!username && (
          <div className="empty">
            <p><b>Start with your own games.</b> Type your chess.com username above. Reviewing your losses is the fastest way to improve.</p>
          </div>
        )}
        {username && games.length > 0 && <GameList games={games} user={username} onSelect={setSelected} />}
        {username && !loading && !error && games.length === 0 && <div className="empty muted">No standard chess games in the last two months.</div>}
        {username && loadedCount < archives.length && !loading && (
          <button className="btn-secondary wide" onClick={loadMore}>Load older months</button>
        )}
        {username && loading && games.length > 0 && <div className="page-loading"><span className="spinner" /></div>}
      </div>
    </>
  );
}
