import { useEffect, useState } from 'react';
import { explore, resultText } from '../lib/masterDb';
import type { DbGame, ExploreResult } from '../lib/masterDb';
import { WdlBar } from './WdlBar';

const RATING_FILTERS = [
  { value: 0, label: 'All' },
  { value: 2200, label: '2200+' },
  { value: 2400, label: '2400+' },
  { value: 2600, label: '2600+' },
];

interface Props {
  fens: string[]; // the line so far, start position first; the last one is explored
  onPlay: (san: string) => void;
  onOpenGame: (game: DbGame) => void;
  compact?: boolean;
}

export function GameLine({ g, onClick }: { g: DbGame; onClick: () => void }) {
  return (
    <button className="db-game" onClick={onClick}>
      <span className="db-players">
        <span className="dot white" />
        <span className="ellipsis">{g.white_title && <span className="title-badge sm">{g.white_title}</span>}{g.white}</span>
        <span className="muted">{g.white_elo || ''}</span>
        <span className="dot black" />
        <span className="ellipsis">{g.black_title && <span className="title-badge sm">{g.black_title}</span>}{g.black}</span>
        <span className="muted">{g.black_elo || ''}</span>
      </span>
      <span className={`db-result r${g.result}`}>{resultText(g.result)}</span>
      <span className="db-event ellipsis muted">
        {g.online ? <span className="tag-mini online">online</span> : null}
        {g.speed !== 'classical' ? <span className="tag-mini">{g.speed}</span> : null}
        {g.event}{g.year ? ` ${g.year}` : ''}
      </span>
    </button>
  );
}

export function MasterExplorer({ fens, onPlay, onOpenGame, compact }: Props) {
  const [minElo, setMinElo] = useState(0);
  const [online, setOnline] = useState(false);
  const [data, setData] = useState<{ key: string; result: ExploreResult } | null>(null);
  const [error, setError] = useState('');
  const lineKey = fens.join(';');
  const key = `${minElo}|${online}|${lineKey}`;

  useEffect(() => {
    const ctrl = new AbortController();
    explore(lineKey.split(';'), minElo, online, ctrl.signal)
      .then((result) => {
        setError('');
        setData({ key: `${minElo}|${online}|${lineKey}`, result });
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setError((e as Error).message);
      });
    return () => ctrl.abort();
  }, [lineKey, minElo, online]);

  const result = data?.result;
  const stale = data?.key !== key; // keep showing the previous position, dimmed, while loading

  return (
    <div className={`master-explorer ${compact ? 'compact' : ''}`}>
      <div className="mx-head">
        <div className="mx-opening">
          {result?.opening ? (
            <>
              <span className="eco">{result.opening.eco}</span> {result.opening.name}
            </>
          ) : (
            <span className="muted">{!result ? '…' : fens.length > 1 ? 'Unnamed line' : 'Starting position'}</span>
          )}
        </div>
        <div className="chips">
          <button className={`chip ${!online ? 'on' : ''}`} onClick={() => setOnline(false)} title="Only games played over the board">Over the board</button>
          <button className={`chip ${online ? 'on' : ''}`} onClick={() => setOnline(true)} title="Also include online events (chess.com, lichess)">+ Online</button>
          <span className="chip-sep" />
          {RATING_FILTERS.map((f) => (
            <button key={f.value} className={`chip ${minElo === f.value ? 'on' : ''}`} onClick={() => setMinElo(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <div className={stale ? 'mx-body stale' : 'mx-body'}>
        {result && (
          <>
            <table className="mx-table">
              <thead>
                <tr>
                  <th>Move</th>
                  <th className="num">Games</th>
                  <th className="wdl-col">White / Draw / Black</th>
                  {!compact && <th className="num">Avg</th>}
                  {!compact && <th className="num">Last</th>}
                </tr>
              </thead>
              <tbody>
                {result.moves.slice(0, compact ? 8 : 30).map((m) => (
                  <tr key={m.move} onClick={() => onPlay(m.move)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onPlay(m.move)}>
                    <td className="mx-move">{m.move}</td>
                    <td className="num">{m.n.toLocaleString()}<span className="muted small"> {Math.round((m.n / result.total) * 100)}%</span></td>
                    <td className="wdl-col"><WdlBar w={m.w} d={m.d} b={m.b} /></td>
                    {!compact && <td className="num muted">{m.elo ?? '–'}</td>}
                    {!compact && <td className="num muted">{m.last || '–'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {result.total === 0 && <div className="empty muted">No master games reached this position{minElo ? ` with both players rated ${minElo}+` : ''}.</div>}
            {result.moves.length === 0 && result.total > 0 && <div className="muted small">All {result.total} games ended in this position.</div>}
            {result.total > 0 && (
              <div className="muted small mx-total">
                {result.total.toLocaleString()} game{result.total === 1 ? '' : 's'} reached this position
              </div>
            )}
            {!compact && result.topGames.length > 0 && (
              <div className="mx-games">
                <div className="section-title">Top games from here</div>
                {result.topGames.map((g) => (
                  <GameLine key={g.id} g={g} onClick={() => onOpenGame(g)} />
                ))}
              </div>
            )}
          </>
        )}
        {!result && !error && <div className="page-loading"><span className="spinner" /></div>}
      </div>
    </div>
  );
}
