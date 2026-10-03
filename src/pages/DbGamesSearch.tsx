import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { searchGames, searchPlayers } from '../lib/masterDb';
import type { DbGame, DbPlayer } from '../lib/masterDb';
import { navigate } from '../lib/router';
import { GameLine } from '../components/MasterExplorer';

/** Name search with suggestions; resolves to a player key. */
export function PlayerPicker({ label, value, onChange }: { label: string; value: { key: string; name: string } | null; onChange: (p: { key: string; name: string } | null) => void }) {
  const [text, setText] = useState(value?.name ?? '');
  const [options, setOptions] = useState<DbPlayer[]>([]);
  const [open, setOpen] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  function update(q: string) {
    setText(q);
    onChange(null);
    ctrl.current?.abort();
    if (q.trim().length < 2) return setOptions([]);
    ctrl.current = new AbortController();
    searchPlayers(q, ctrl.current.signal).then(
      (ps) => {
        setOptions(ps);
        setOpen(true);
      },
      () => undefined,
    );
  }

  return (
    <label className="field picker">
      <span>{label}</span>
      <input value={text} onChange={(e) => update(e.target.value)} onFocus={() => options.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder="Any player" aria-label={label} />
      {value && <span className="picked">✓</span>}
      {open && options.length > 0 && (
        <div className="suggest">
          {options.map((p) => (
            <button
              type="button"
              key={p.key}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setText(p.name);
                onChange({ key: p.key, name: p.name });
                setOpen(false);
              }}
            >
              {p.title && <span className="title-badge sm">{p.title}</span>}
              <span className="ellipsis">{p.name}</span>
              <span className="muted small">{p.max_elo || ''} · {p.games} games · {p.first_year}–{p.last_year}</span>
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

const EMPTY = { color: 'any', result: '', eco: '', opening: '', event: '', from: '', to: '', minElo: '', sort: 'date', speed: '', online: '' };

export function DbGamesSearch({ initialPlayer, initialColor, initialOpening }: { initialPlayer?: { key: string; name: string }; initialColor?: string; initialOpening?: string }) {
  const [player, setPlayer] = useState(initialPlayer ?? null);
  const [opponent, setOpponent] = useState<{ key: string; name: string } | null>(null);
  const [form, setForm] = useState({ ...EMPTY, color: initialColor ?? 'any', opening: initialOpening ?? '' });
  const [page, setPage] = useState(0);
  const [results, setResults] = useState<{ games: DbGame[]; total: number; capped: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // the search runs on submit and paging, from a snapshot of the filters (not on every keystroke)
  const snapshot = () => ({
    player: player?.key ?? '',
    color: player ? form.color : '',
    opponent: opponent?.key ?? '',
    result: form.result,
    eco: form.eco,
    opening: form.opening,
    event: form.event,
    from: form.from,
    to: form.to,
    minElo: form.minElo,
    sort: form.sort,
    speed: form.speed,
    online: form.online,
  });
  const [submitted, setSubmitted] = useState(snapshot);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchGames({ ...submitted, page })
      .then((r) => !cancelled && (setResults(r), setError('')))
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [submitted, page]);

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setPage(0);
    setSubmitted(snapshot());
  };

  return (
    <div>
      <form className="db-search" onSubmit={submit}>
        <PlayerPicker label="Player" value={player} onChange={setPlayer} />
        <label className="field">
          <span>Plays</span>
          <select value={form.color} onChange={set('color')} disabled={!player}>
            <option value="any">Either color</option>
            <option value="white">White</option>
            <option value="black">Black</option>
          </select>
        </label>
        <PlayerPicker label="Opponent" value={opponent} onChange={setOpponent} />
        <label className="field">
          <span>Result</span>
          <select value={form.result} onChange={set('result')}>
            <option value="">Any</option>
            <option value="1-0">1-0</option>
            <option value="0-1">0-1</option>
            <option value="draw">½-½</option>
            {player && <option value="win">{player.name.split(',')[0]} won</option>}
            {player && <option value="loss">{player.name.split(',')[0]} lost</option>}
          </select>
        </label>
        <label className="field sm">
          <span>ECO</span>
          <input value={form.eco} onChange={set('eco')} placeholder="B90" maxLength={3} />
        </label>
        <label className="field">
          <span>Opening</span>
          <input value={form.opening} onChange={set('opening')} placeholder="Najdorf, Catalan…" />
        </label>
        <label className="field">
          <span>Event</span>
          <input value={form.event} onChange={set('event')} placeholder="Olympiad, Tata Steel…" />
        </label>
        <label className="field sm">
          <span>From</span>
          <input value={form.from} onChange={set('from')} placeholder="1990" inputMode="numeric" maxLength={4} />
        </label>
        <label className="field sm">
          <span>To</span>
          <input value={form.to} onChange={set('to')} placeholder="2026" inputMode="numeric" maxLength={4} />
        </label>
        <label className="field sm">
          <span>Min Elo</span>
          <input value={form.minElo} onChange={set('minElo')} placeholder="2500" inputMode="numeric" maxLength={4} />
        </label>
        <label className="field">
          <span>Speed</span>
          <select value={form.speed} onChange={set('speed')}>
            <option value="">Any</option>
            <option value="classical">Classical</option>
            <option value="rapid">Rapid</option>
            <option value="blitz">Blitz</option>
          </select>
        </label>
        <label className="field check">
          <span>Online</span>
          <span className="check-row">
            <input type="checkbox" checked={form.online === '1'} onChange={(e) => setForm((f) => ({ ...f, online: e.target.checked ? '1' : '' }))} />
            include
          </span>
        </label>
        <label className="field">
          <span>Sort</span>
          <select value={form.sort} onChange={set('sort')}>
            <option value="date">Newest first</option>
            <option value="elo">Highest rated</option>
          </select>
        </label>
        <button className="btn-green" disabled={loading}>Search</button>
      </form>

      {error && <div className="error">{error}</div>}
      {results && (
        <div className={loading ? 'db-results stale' : 'db-results'}>
          <div className="row-between db-results-head">
            <b>{results.capped ? 'More than 10,000' : results.total.toLocaleString()} games</b>
            {results.total > 50 && (
              <span className="row">
                <button className="btn-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Prev</button>
                <span className="muted small">{page * 50 + 1}–{Math.min((page + 1) * 50, results.total)}</span>
                <button className="btn-secondary" disabled={(page + 1) * 50 >= results.total} onClick={() => setPage((p) => p + 1)}>Next →</button>
              </span>
            )}
          </div>
          {results.games.map((g) => (
            <div key={g.id} className="db-row">
              <GameLine g={g} onClick={() => navigate(`database/game/${g.id}`)} />
              <span className="db-opening muted small ellipsis">{g.eco} {g.opening}</span>
            </div>
          ))}
          {results.games.length === 0 && <div className="empty muted">No games match these filters.</div>}
        </div>
      )}
    </div>
  );
}
