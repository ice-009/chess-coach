import { useCallback, useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { ON_DEVICE, explore, fetchStatus, startBuild } from '../lib/masterDb';
import type { DbStatus } from '../lib/masterDb';
import { navigate } from '../lib/router';
import { Board } from '../components/Board';
import type { Promotion } from '../components/Board';
import { MasterExplorer } from '../components/MasterExplorer';
import { DeviceDatabase } from '../components/DeviceDatabase';
import { DbGamesSearch } from './DbGamesSearch';
import { DbPlayerDossier, DbPlayers } from './DbPlayer';
import { DbGameViewer } from './DbGameViewer';
import { useFitTop } from '../lib/useFitTop';

const SIZES = [
  { issues: 52, label: 'Last year', note: 'recommended to start' },
  { issues: 156, label: 'Last 3 years', note: 'about 3× the download' },
  { issues: 520, label: 'Last 10 years', note: 'large; takes a few hours to download' },
];

/** Shown until the database exists, and for updates. Starts the local build and shows its progress. */
function DbSetup({ status, onStarted, update }: { status: DbStatus; onStarted: () => void; update?: boolean }) {
  const [issues, setIssues] = useState(52);
  const [error, setError] = useState('');
  const b = status.build;
  const running = b.running;

  return (
    <div className="db-setup">
      {!update && (
        <>
          <h2>Build your master database</h2>
          <p>
            This downloads real over-the-board master games to your computer and indexes them for the explorer, search and player pages:
          </p>
          <ul className="tips">
            <li><b>The Week in Chess</b>: every week's top tournaments with ratings, titles and FIDE IDs (both players rated 2000+), over the board plus major online events, which are tagged so you can include or exclude them. TWIC is free for personal use; consider supporting it at theweekinchess.com.</li>
            <li><b>pgnmentor.com</b>: the complete games of 37 world champions and elite players, from Morphy to Gukesh.</li>
            <li><b>Lichess opening names</b> (public domain) to name every position.</li>
          </ul>
        </>
      )}
      {running ? (
        <div className="build-progress">
          <div className="row-between">
            <b>{b.state === 'downloading' ? 'Downloading games…' : 'Building the index…'}</b>
            <span className="muted small">{Math.round(b.progress * 100)}%</span>
          </div>
          <div className="progress big"><div style={{ width: `${b.progress * 100}%`, transform: 'none' }} /></div>
          <div className="muted small">{b.step}</div>
          <div className="muted small">You can keep using the app; this page updates by itself.</div>
        </div>
      ) : (
        <>
          <div className="size-options">
            {SIZES.map((s) => (
              <label key={s.issues} className={`size-option ${issues === s.issues ? 'on' : ''}`}>
                <input type="radio" name="size" checked={issues === s.issues} onChange={() => setIssues(s.issues)} />
                <b>{s.label}</b>
                <span className="muted small">{s.note}</span>
              </label>
            ))}
          </div>
          {b.state === 'error' && <div className="error">The last build failed: {b.error}</div>}
          {error && <div className="error">{error}</div>}
          <button
            className="btn-green"
            onClick={() => startBuild(issues).then(onStarted, (e) => setError((e as Error).message))}
          >
            {update ? 'Update database' : 'Build database'}
          </button>
          <p className="muted small">Already-downloaded weeks are reused, so updating later only fetches new games.</p>
        </>
      )}
    </div>
  );
}

function DbExplorer({ initialLine }: { initialLine?: string }) {
  const fitRef = useFitTop<HTMLDivElement>();
  const start = useMemo(() => {
    const c = new Chess();
    const fens = [c.fen()];
    const sans: string[] = [];
    for (const san of (initialLine ?? '').split(',').filter(Boolean)) {
      try {
        sans.push(c.move(san).san);
        fens.push(c.fen());
      } catch {
        break;
      }
    }
    return { fens, sans };
  }, [initialLine]);
  const [hist, setHist] = useState(start);
  const [idx, setIdx] = useState(start.sans.length);
  const [flip, setFlip] = useState(false);
  const fen = hist.fens[idx];

  const play = useCallback(
    (san: string) => {
      const c = new Chess(fen);
      let m;
      try {
        m = c.move(san);
      } catch {
        return false;
      }
      setHist((h) => ({ fens: [...h.fens.slice(0, idx + 1), c.fen()], sans: [...h.sans.slice(0, idx), m.san] }));
      setIdx(idx + 1);
      return true;
    },
    [fen, idx],
  );

  const onMove = useCallback(
    (from: Square, to: Square, promotion: Promotion = 'q') => {
      const c = new Chess(fen);
      try {
        return play(c.move({ from, to, promotion }).san);
      } catch {
        return false;
      }
    },
    [fen, play],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(hist.fens.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hist.fens.length]);

  const fens = useMemo(() => hist.fens.slice(0, idx + 1), [hist.fens, idx]);

  // when a line leaves master play, find the last move masters still reached
  const [deviation, setDeviation] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    setDeviation(null);
    (async () => {
      const here = await explore(fens, 0, false);
      if (cancelled || here.total > 0 || fens.length < 2) return;
      for (let k = fens.length - 2; k >= 0; k--) {
        if ((await explore(fens.slice(0, k + 1), 0, false)).total > 0) {
          if (!cancelled) setDeviation(k);
          return;
        }
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [fens]);
  const lastMove = useMemo(() => (idx > 0 ? new Chess(hist.fens[idx - 1]).move(hist.sans[idx - 1]) : null), [hist, idx]);
  const squares = useMemo<Record<string, string>>(
    () => (lastMove ? { [lastMove.from]: 'rgba(255,255,51,0.45)', [lastMove.to]: 'rgba(255,255,51,0.45)' } : {}),
    [lastMove],
  );

  return (
    <div className="analysis db-explorer" ref={fitRef}>
      <div>
        <Board id="db-board" fen={fen} orientation={flip ? 'black' : 'white'} onMove={onMove} squares={squares} />
        <div className="nav">
          <button onClick={() => setIdx(0)} aria-label="Start">⏮</button>
          <button onClick={() => setIdx((i) => Math.max(0, i - 1))} aria-label="Back">◀</button>
          <button onClick={() => setIdx((i) => Math.min(hist.fens.length - 1, i + 1))} aria-label="Forward">▶</button>
          <button onClick={() => setIdx(hist.fens.length - 1)} aria-label="End">⏭</button>
          <button onClick={() => setFlip((f) => !f)}>⇅ Flip</button>
          <button onClick={() => navigate(`explore?fen=${encodeURIComponent(fen)}`)}>Engine ↗</button>
        </div>
        <div className="book db-line">
          {hist.sans.length === 0 && <span className="muted">Play a move on the board or click one in the table.</span>}
          {hist.sans.map((san, i) => (
            <span key={i}>
              {i % 2 === 0 && <span className="muted">{i / 2 + 1}. </span>}
              <button className={`move inline ${idx === i + 1 ? 'active' : ''}`} onClick={() => setIdx(i + 1)}>{san}</button>{' '}
            </span>
          ))}
        </div>
      </div>
      <div className="panel">
        {deviation !== null && (
          <div className="note">
            Masters never reached this position. They left your line after{' '}
            <b>{deviation > 0 ? `${Math.ceil(deviation / 2)}${deviation % 2 ? '.' : '…'} ${hist.sans[deviation - 1]}` : 'the start'}</b>
            : your next move{deviation < hist.sans.length ? ` (${hist.sans[deviation]})` : ''} is not in master play.{' '}
            <button className="link" onClick={() => setIdx(deviation)}>See what masters play there →</button>
          </div>
        )}
        <MasterExplorer fens={fens} onPlay={play} onOpenGame={(g) => navigate(`database/game/${g.id}?ply=${g.ply ?? idx}`)} />
      </div>
    </div>
  );
}

const TABS = [
  { id: '', label: 'Opening explorer' },
  { id: 'games', label: 'Games' },
  { id: 'players', label: 'Players' },
];

export function DatabasePage(props: { sub?: string; arg?: string; query: URLSearchParams }) {
  return <LocalDatabase {...props} />;
}

function LocalDatabase({ sub, arg, query }: { sub?: string; arg?: string; query: URLSearchParams }) {
  const [status, setStatus] = useState<DbStatus | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);

  const refresh = useCallback(() => fetchStatus().then(setStatus, () => setStatus(null)), []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  // poll while a build is running
  useEffect(() => {
    if (!status?.build.running) return;
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, [status?.build.running, refresh]);

  if (!status) return <div className="page-loading"><span className="spinner" /></div>;
  if (sub === 'game' && status.ready) return <DbGameViewer id={Number(arg)} ply={query.get('ply') ? Number(query.get('ply')) : undefined} />;

  const m = status.meta;
  return (
    <div>
      <div className="page-head row-between">
        <div>
          <h1>Master Database</h1>
          {m ? (
            <p className="muted">
              {Number(m.otb_games ?? m.games).toLocaleString()} over-the-board games{Number(m.online_games) > 0 ? ` + ${Number(m.online_games).toLocaleString()} online` : ''} · {Number(m.players).toLocaleString()} players · {m.first_year}–{m.last_year}
            </p>
          ) : (
            <p className="muted">Your own ChessBase-style library of over-the-board master games.</p>
          )}
        </div>
        {status.ready && !status.build.running && !ON_DEVICE && (
          <button className="btn-secondary" onClick={() => setShowUpdate((v) => !v)}>{showUpdate ? 'Close' : 'Update / expand'}</button>
        )}
        {status.ready && ON_DEVICE && <a className="btn-ghost" href="#/offline">On this device · Manage</a>}
      </div>

      {/* the hosted site has no server: the database is loaded onto the device instead of built */}
      {ON_DEVICE && !status.ready && <DeviceDatabase onChange={() => refresh()} />}
      {!ON_DEVICE && (!status.ready || status.build.running || showUpdate) && <DbSetup status={status} onStarted={refresh} update={status.ready} />}

      {status.ready && (
        <>
          <div className="seg">
            {TABS.map((t) => (
              <button key={t.id} className={(sub ?? '') === t.id || (t.id === 'players' && sub === 'player') ? 'on' : ''} onClick={() => navigate(`database${t.id ? `/${t.id}` : ''}`)}>
                {t.label}
              </button>
            ))}
          </div>
          {!sub && <DbExplorer initialLine={query.get('line') ?? undefined} />}
          {sub === 'games' && (
            <DbGamesSearch
              initialPlayer={query.get('player') ? { key: query.get('player')!, name: query.get('name') ?? query.get('player')! } : undefined}
              initialColor={query.get('color') ?? undefined}
              initialOpening={query.get('opening') ?? undefined}
            />
          )}
          {sub === 'players' && <DbPlayers />}
          {sub === 'player' && arg && <DbPlayerDossier playerKey={arg} />}
        </>
      )}
    </div>
  );
}
