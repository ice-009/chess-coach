import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { summarize } from '../lib/chesscom';
import type { ChessComGame } from '../lib/chesscom';
import { accuracyIndex } from '../lib/analysis';

interface Props {
  games: ChessComGame[];
  user: string;
  onSelect: (game: ChessComGame) => void;
}

const PAGE = 50;

const TIME_ICON: Record<string, ReactNode> = {
  bullet: <svg viewBox="0 0 24 24" fill="#e3aa24"><path d="M5 15.5L14.5 6a3.5 3.5 0 0 1 5 5L10 20.5H5z" /></svg>,
  blitz: <svg viewBox="0 0 24 24" fill="#f7c631"><path d="M13 2L4 14h6l-1 8 9-12h-6z" /></svg>,
  rapid: <svg viewBox="0 0 24 24" fill="none" stroke="#81b64c" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M9 2h6" /></svg>,
  daily: <svg viewBox="0 0 24 24" fill="#f7c631"><circle cx="12" cy="12" r="5" /><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="#f7c631" strokeWidth="2" /></svg>,
};

export function GameList({ games, user, onSelect }: Props) {
  const [timeClass, setTimeClass] = useState('all');
  const [result, setResult] = useState('all');
  const [color, setColor] = useState('all');
  const [shown, setShown] = useState(PAGE);
  const acc = accuracyIndex(); // re-read each render so freshly reviewed games show their accuracy

  const rows = useMemo(
    () =>
      games
        .map((g) => summarize(g, user))
        .filter((r) => timeClass === 'all' || r.game.time_class === timeClass)
        .filter((r) => result === 'all' || r.outcome === result)
        .filter((r) => color === 'all' || r.color === color),
    [games, user, timeClass, result, color],
  );

  const wins = rows.filter((r) => r.outcome === 'win').length;
  const losses = rows.filter((r) => r.outcome === 'loss').length;
  const avgOpp = rows.length ? Math.round(rows.reduce((sum, r) => sum + r.opp.rating, 0) / rows.length) : 0;

  return (
    <div className="archive">
      <div className="archive-bar">
        <div className="filters">
          <select value={timeClass} onChange={(e) => { setTimeClass(e.target.value); setShown(PAGE); }} aria-label="Time control">
            <option value="all">All time controls</option>
            <option value="bullet">Bullet</option>
            <option value="blitz">Blitz</option>
            <option value="rapid">Rapid</option>
            <option value="daily">Daily</option>
          </select>
          <select value={result} onChange={(e) => { setResult(e.target.value); setShown(PAGE); }} aria-label="Result">
            <option value="all">All results</option>
            <option value="win">Wins</option>
            <option value="loss">Losses</option>
            <option value="draw">Draws</option>
          </select>
          <select value={color} onChange={(e) => { setColor(e.target.value); setShown(PAGE); }} aria-label="Color">
            <option value="all">Both colors</option>
            <option value="white">As White</option>
            <option value="black">As Black</option>
          </select>
        </div>
        <div className="wl">
          <span>{rows.length} games</span>
          <span className="win">{wins}W</span>
          <span className="loss">{losses}L</span>
          <span className="draw">{rows.length - wins - losses}D</span>
          {rows.length > 0 && <span className="muted">avg. opponent {avgOpp}</span>}
        </div>
      </div>

      <div className="table-wrap">
        <table className="games-table">
          <thead>
            <tr>
              <th />
              <th>Players</th>
              <th className="center">Result</th>
              <th className="center hide-sm">Accuracy</th>
              <th className="center hide-sm">Moves</th>
              <th className="right">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map((r) => {
              const a = acc[r.game.url];
              const whiteWon = r.game.white.result === 'win';
              const blackWon = r.game.black.result === 'win';
              return (
                <tr key={r.game.url} onClick={() => onSelect(r.game)}>
                  <td className="tc" title={r.game.time_class}>{TIME_ICON[r.game.time_class]}</td>
                  <td>
                    <div className="players">
                      <div><span className="dot white" /><b className={r.color === 'white' ? 'me' : ''}>{r.game.white.username}</b> <span className="muted">({r.game.white.rating})</span></div>
                      <div><span className="dot black" /><b className={r.color === 'black' ? 'me' : ''}>{r.game.black.username}</b> <span className="muted">({r.game.black.rating})</span></div>
                    </div>
                    <div className="opening-name">{r.opening}</div>
                  </td>
                  <td className="center">
                    <div className="result-cell">
                      <div className="score-col"><span>{whiteWon ? 1 : blackWon ? 0 : '½'}</span><span>{blackWon ? 1 : whiteWon ? 0 : '½'}</span></div>
                      <span className={`result-badge ${r.outcome}`}>{r.outcome === 'win' ? '+' : r.outcome === 'loss' ? '−' : '='}</span>
                    </div>
                  </td>
                  <td className="center hide-sm">
                    {a ? (
                      <div className="score-col acc"><span>{a[0].toFixed(1)}</span><span>{a[1].toFixed(1)}</span></div>
                    ) : (
                      <span className="review-link">Review</span>
                    )}
                  </td>
                  <td className="center hide-sm muted">{r.moves}</td>
                  <td className="right muted nowrap">{r.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > shown && (
        <button className="btn-secondary wide" onClick={() => setShown((s) => s + PAGE)}>
          Show more ({rows.length - shown} left)
        </button>
      )}
    </div>
  );
}
