import { memo } from 'react';
import { defaultPieces } from 'react-chessboard';
import { material } from '../lib/chess';

/** The pieces `side` has captured (small, grouped by kind) and its material lead, like chess.com's player bars. */
export const Captured = memo(function Captured({ fen, side }: { fen: string; side: 'w' | 'b' }) {
  const { captured, diff } = material(fen);
  const lead = side === 'w' ? diff : -diff;
  const pieces = captured[side];
  if (!pieces.length && lead <= 0) return null;
  const enemy = side === 'w' ? 'b' : 'w';
  const groups = pieces.reduce<string[][]>((acc, t) => {
    if (acc.length && acc[acc.length - 1][0] === t) acc[acc.length - 1].push(t);
    else acc.push([t]);
    return acc;
  }, []);
  return (
    <span className="captured" aria-label={`${side === 'w' ? 'White' : 'Black'} has captured ${pieces.length} piece${pieces.length === 1 ? '' : 's'}${lead > 0 ? `, ahead by ${lead}` : ''}`}>
      {groups.map((g, i) => (
        <span key={i} className="cap-group">
          {g.map((t, j) => (
            <span key={j} className="cap-piece">{defaultPieces[`${enemy}${t.toUpperCase()}`]?.({ svgStyle: { width: '100%', height: '100%' } })}</span>
          ))}
        </span>
      ))}
      {lead > 0 && <span className="cap-lead">+{lead}</span>}
    </span>
  );
});
