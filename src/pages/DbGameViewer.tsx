import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import type { ParsedGame } from '../lib/analysis';
import { getGame, resultText } from '../lib/masterDb';
import type { DbGame } from '../lib/masterDb';
import { navigate } from '../lib/router';
import { AnalysisView } from '../components/AnalysisView';

/** Replays stored SAN moves; stops at the first move that doesn't parse (rare damaged games). */
function toParsed(moves: string): { parsed: ParsedGame; sans: string[] } {
  const c = new Chess();
  const fens = [c.fen()];
  const out: ParsedGame['moves'] = [];
  const sans: string[] = [];
  for (const san of moves.split(' ').filter(Boolean)) {
    let m;
    try {
      m = c.move(san);
    } catch {
      break;
    }
    out.push({ san: m.san, uci: m.from + m.to + (m.promotion ?? ''), from: m.from, to: m.to, color: m.color, captured: !!m.captured });
    sans.push(m.san);
    fens.push(c.fen());
  }
  return { parsed: { fens, moves: out }, sans };
}

export function DbGameViewer({ id, ply }: { id: number; ply?: number }) {
  const [game, setGame] = useState<DbGame | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getGame(id).then(setGame, (e) => setError((e as Error).message));
  }, [id]);

  const data = useMemo(() => (game?.moves ? toParsed(game.moves) : null), [game]);

  if (error) return <div className="error">{error}</div>;
  if (!game || !data) return <div className="page-loading"><span className="spinner" /></div>;

  const perspective = game.result === -1 ? 'b' : 'w';
  return (
    <div>
      <div className="db-game-head">
        <span className="eco">{game.eco}</span>
        <span>{game.opening || 'Unknown opening'}</span>
        <span className="muted">· {game.event}{game.site ? `, ${game.site}` : ''}{game.round && game.round !== '?' ? `, round ${game.round}` : ''} · {game.date.replace(/\.\?\?/g, '')}</span>
        <span className={`db-result r${game.result}`}>{resultText(game.result)}</span>
      </div>
      <AnalysisView
        cacheKey={`db:${game.id}`}
        parsed={data.parsed}
        white={{ name: `${game.white_title ? `${game.white_title} ` : ''}${game.white}`, rating: game.white_elo || undefined }}
        black={{ name: `${game.black_title ? `${game.black_title} ` : ''}${game.black}`, rating: game.black_elo || undefined }}
        perspective={perspective}
        result={game.result === 0 ? 'draw' : 'win'}
        meta={{ opening: game.opening, timeControl: 'classical (over the board)' }}
        initialPly={ply}
        showCoach={false}
        onBack={() => history.back()}
        backLabel="← Back"
        extraAction={{ label: 'Explorer ↗', onClick: (p) => navigate(`database?line=${encodeURIComponent(data.sans.slice(0, p).join(','))}`) }}
      />
    </div>
  );
}
