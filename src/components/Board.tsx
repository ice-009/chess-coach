import { memo, useCallback, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import type { Classification } from '../lib/analysis';
import { ClassIcon } from './icons';

export type ArrowSpec = string | [string, string]; // "e2e4" or ["e2e4", color]

interface Props {
  id: string;
  fen: string;
  orientation?: 'white' | 'black';
  arrows?: ArrowSpec[];
  squares?: Record<string, string>; // square → background colour
  badge?: { square: string; c: Classification }; // classification icon in the corner of a square
  onMove?: (from: Square, to: Square) => boolean; // pieces are movable only when given
  onSquare?: (square: Square) => void; // plain square clicks (board-vision trainer)
  hideCoords?: boolean;
  maxWidth?: number;
}

const DARK = { backgroundColor: '#739552' };
const LIGHT = { backgroundColor: '#ebecd0' };
const NOTATION_DARK = { color: '#ebecd0', fontWeight: 700 };
const NOTATION_LIGHT = { color: '#739552', fontWeight: 700 };
const DROP = { boxShadow: 'inset 0 0 0 4px rgba(255,255,255,0.55)' };

/** Chessboard that fills its container (up to maxWidth). Supports drag-and-drop and click-to-move. */
export const Board = memo(function Board({ id, fen, orientation = 'white', arrows = [], squares = {}, badge, onMove, onSquare, hideCoords, maxWidth = 640 }: Props) {
  // a selection belongs to the position it was made in, so it clears itself when the position changes
  const [selection, setSelection] = useState<{ fen: string; square: Square } | null>(null);
  const selected = selection?.fen === fen ? selection.square : null;

  const targets = useMemo<Square[]>(() => {
    if (!onMove || !selected) return [];
    try {
      return new Chess(fen).moves({ square: selected, verbose: true }).map((m) => m.to);
    } catch {
      return [];
    }
  }, [fen, selected, onMove]);

  const squaresKey = JSON.stringify(squares);
  const squareStyles = useMemo(() => {
    const out: Record<string, CSSProperties> = {};
    for (const [sq, bg] of Object.entries(JSON.parse(squaresKey) as Record<string, string>)) out[sq] = { background: bg };
    if (selected) out[selected] = { background: 'rgba(255,255,51,0.5)' };
    for (const t of targets) out[t] = { ...out[t], backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.18) 19%, transparent 21%)' };
    return out;
  }, [squaresKey, selected, targets]);

  const arrowsKey = JSON.stringify(arrows);
  const boardArrows = useMemo(
    () =>
      (JSON.parse(arrowsKey) as ArrowSpec[]).map((a) => {
        const [uci, color] = typeof a === 'string' ? [a, 'rgba(255,170,0,0.8)'] : a;
        return { startSquare: uci.slice(0, 2), endSquare: uci.slice(2, 4), color };
      }),
    [arrowsKey],
  );

  const onSquareClick = useCallback(
    ({ square }: { square: string }) => {
      if (onSquare) return onSquare(square as Square);
      if (!onMove) return;
      const sq = square as Square;
      if (selected && targets.includes(sq)) {
        setSelection(null);
        onMove(selected, sq);
        return;
      }
      let piece = null;
      try {
        piece = new Chess(fen).get(sq);
      } catch {
        piece = null;
      }
      setSelection(piece && piece.color === fen.split(' ')[1] && sq !== selected ? { fen, square: sq } : null);
    },
    [onMove, onSquare, selected, targets, fen],
  );

  const badgeSquare = badge?.square;
  const badgeClass = badge?.c;
  const squareRenderer = useCallback(
    ({ square, children }: { square: string; children?: ReactNode }) => (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {children}
        {square === badgeSquare && badgeClass && (
          <span className="board-badge">
            <ClassIcon c={badgeClass} size={26} />
          </span>
        )}
      </div>
    ),
    [badgeSquare, badgeClass],
  );

  const options = useMemo(
    () => ({
      id,
      position: fen,
      boardOrientation: orientation,
      allowDragging: !!onMove,
      allowDrawingArrows: true,
      clearArrowsOnPositionChange: true,
      onPieceDrop: ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
        setSelection(null);
        return !!onMove && !!targetSquare && onMove(sourceSquare as Square, targetSquare as Square);
      },
      onSquareClick,
      arrows: boardArrows,
      squareStyles,
      squareRenderer,
      darkSquareStyle: DARK,
      lightSquareStyle: LIGHT,
      darkSquareNotationStyle: NOTATION_DARK,
      lightSquareNotationStyle: NOTATION_LIGHT,
      dropSquareStyle: DROP,
      animationDurationInMs: 160,
      showNotation: !hideCoords,
    }),
    [id, fen, orientation, onMove, onSquareClick, boardArrows, squareStyles, squareRenderer, hideCoords],
  );

  return (
    <div className="board-box" style={{ maxWidth }} data-fen={fen}>
      <Chessboard options={options} />
    </div>
  );
});
