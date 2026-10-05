import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Chessboard, defaultPieces } from 'react-chessboard';
import { Chess } from 'chess.js';
import type { Move, Square } from 'chess.js';
import type { Classification } from '../lib/analysis';
import { playSound } from '../lib/sound';
import { ClassIcon } from './icons';

export type ArrowSpec = string | [string, string]; // "e2e4" or ["e2e4", color]
export type Promotion = 'q' | 'r' | 'b' | 'n';

interface Props {
  id: string;
  fen: string;
  orientation?: 'white' | 'black';
  arrows?: ArrowSpec[];
  squares?: Record<string, string>; // square → background colour
  badge?: { square: string; c: Classification }; // classification icon in the corner of a square
  /** Pieces are movable only when given. A pawn reaching the last rank asks which piece first. */
  onMove?: (from: Square, to: Square, promotion?: Promotion) => boolean;
  onSquare?: (square: Square) => void; // plain square clicks (board-vision trainer)
  hideCoords?: boolean;
  maxWidth?: number;
  silent?: boolean; // no move sounds
}

const DARK = { backgroundColor: '#739552' };
const LIGHT = { backgroundColor: '#ebecd0' };
const NOTATION_DARK = { color: '#ebecd0', fontWeight: 700 };
const NOTATION_LIGHT = { color: '#739552', fontWeight: 700 };
const DROP = { boxShadow: 'inset 0 0 0 4px rgba(255,255,255,0.55)' };
const LAST_MOVE = 'rgba(255,255,51,0.42)';
const DOT = 'radial-gradient(circle, rgba(0,0,0,0.16) 19%, transparent 21%)';
const RING = 'radial-gradient(circle, transparent 72%, rgba(0,0,0,0.16) 74%)';
const CHECK = 'radial-gradient(circle, rgba(255,0,0,0.9) 0%, rgba(231,0,0,0.6) 30%, rgba(169,0,0,0) 75%)';

const placement = (fen: string) => fen.split(' ').slice(0, 2).join(' ');
const safeChess = (fen: string) => {
  try {
    return new Chess(fen);
  } catch {
    return null;
  }
};

/** The single legal move that turns one position into the next, if there is one. */
function moveBetween(before: string, after: string): Move | null {
  const c = safeChess(before);
  if (!c) return null;
  const target = placement(after);
  for (const m of c.moves({ verbose: true })) {
    c.move(m);
    const hit = placement(c.fen()) === target;
    c.undo();
    if (hit) return m;
  }
  return null;
}

function soundFor(m: Move, after: string) {
  const c = safeChess(after);
  if (c?.isGameOver()) {
    playSound(m.captured ? 'capture' : 'move');
    window.setTimeout(() => playSound('end'), 160);
  } else if (c?.inCheck()) playSound('check');
  else if (m.promotion) playSound('promote');
  else if (m.flags.includes('k') || m.flags.includes('q')) playSound('castle');
  else playSound(m.captured ? 'capture' : 'move');
}

/**
 * Chessboard that fills its container (up to maxWidth), styled and behaving like chess.com: drag-and-drop or
 * click-to-move with dots on legal squares and rings on captures, the last move highlighted, a red glow on a
 * king in check, a piece picker for promotions, and a sound for every move.
 */
export const Board = memo(function Board({ id, fen, orientation = 'white', arrows = [], squares = {}, badge, onMove, onSquare, hideCoords, maxWidth = 640, silent }: Props) {
  // a selection belongs to the position it was made in, so it clears itself when the position changes
  const [selection, setSelection] = useState<{ fen: string; square: Square } | null>(null);
  const selected = selection?.fen === fen ? selection.square : null;
  const [promo, setPromo] = useState<{ fen: string; from: Square; to: Square } | null>(null);
  const pending = promo?.fen === fen ? promo : null;

  // the move that led here (when the position changed by one move): highlight it and play its sound
  const prevFen = useRef(fen);
  const [last, setLast] = useState<{ fen: string; from: string; to: string } | null>(null);
  useEffect(() => {
    const before = prevFen.current;
    prevFen.current = fen;
    if (before === fen) return;
    const m = moveBetween(before, fen);
    if (!m) return;
    setLast({ fen, from: m.from, to: m.to });
    if (!silent) soundFor(m, fen);
  }, [fen, silent]);
  const lastMove = last?.fen === fen ? last : null;

  const legal = useMemo<Move[]>(() => {
    if (!onMove || !selected) return [];
    return safeChess(fen)?.moves({ square: selected, verbose: true }) ?? [];
  }, [fen, selected, onMove]);
  const targets = useMemo(() => [...new Set(legal.map((m) => m.to))], [legal]);

  const checkSquare = useMemo(() => {
    const c = safeChess(fen);
    if (!c?.inCheck()) return null;
    const turn = c.turn();
    for (const row of c.board()) for (const p of row) if (p?.type === 'k' && p.color === turn) return p.square;
    return null;
  }, [fen]);

  const squaresKey = JSON.stringify(squares);
  const squareStyles = useMemo(() => {
    const out: Record<string, CSSProperties> = {};
    if (lastMove) out[lastMove.from] = out[lastMove.to] = { background: LAST_MOVE };
    for (const [sq, bg] of Object.entries(JSON.parse(squaresKey) as Record<string, string>)) out[sq] = { background: bg };
    if (checkSquare) out[checkSquare] = { ...out[checkSquare], backgroundImage: CHECK };
    if (selected) out[selected] = { background: 'rgba(255,255,51,0.5)' };
    for (const m of legal) out[m.to] = { ...out[m.to], backgroundImage: m.captured ? RING : DOT };
    return out;
  }, [squaresKey, lastMove, checkSquare, selected, legal]);

  const arrowsKey = JSON.stringify(arrows);
  const boardArrows = useMemo(
    () =>
      (JSON.parse(arrowsKey) as ArrowSpec[]).map((a) => {
        const [uci, color] = typeof a === 'string' ? [a, 'rgba(255,170,0,0.8)'] : a;
        return { startSquare: uci.slice(0, 2), endSquare: uci.slice(2, 4), color };
      }),
    [arrowsKey],
  );

  /** Moves a piece, or opens the promotion picker first. Returns whether the board should show the move now. */
  const tryMove = useCallback(
    (from: Square, to: Square): boolean => {
      if (!onMove) return false;
      const moves = safeChess(fen)?.moves({ square: from, verbose: true }) ?? [];
      if (moves.some((m) => m.to === to && m.promotion)) {
        setPromo({ fen, from, to });
        return false;
      }
      return onMove(from, to);
    },
    [onMove, fen],
  );

  // pressing a piece starts a "drag" (which selects it); releasing on the same square is a tap that keeps it
  const dragFrom = useRef<string | null>(null);

  const onSquareClick = useCallback(
    ({ square }: { square: string }) => {
      if (onSquare) return onSquare(square as Square);
      if (!onMove || pending) return;
      const sq = square as Square;
      if (dragFrom.current === sq) {
        dragFrom.current = null;
        setSelection({ fen, square: sq });
        return;
      }
      dragFrom.current = null;
      if (selected && targets.includes(sq)) {
        setSelection(null);
        tryMove(selected, sq);
        return;
      }
      const piece = safeChess(fen)?.get(sq);
      setSelection(piece && piece.color === fen.split(' ')[1] && sq !== selected ? { fen, square: sq } : null);
    },
    [onMove, onSquare, pending, selected, targets, fen, tryMove],
  );

  const badgeSquare = badge?.square;
  const badgeClass = badge?.c;
  // a custom square renderer replaces the library's own square, which is what applies squareStyles: apply them here
  const squareRenderer = useCallback(
    ({ square, children }: { square: string; children?: ReactNode }) => (
      <div style={{ position: 'relative', width: '100%', height: '100%', ...squareStyles[square] }}>
        {children}
        {square === badgeSquare && badgeClass && (
          <span className="board-badge">
            <ClassIcon c={badgeClass} size={26} />
          </span>
        )}
      </div>
    ),
    [badgeSquare, badgeClass, squareStyles],
  );

  const options = useMemo(
    () => ({
      id,
      position: fen,
      boardOrientation: orientation,
      allowDragging: !!onMove && !pending,
      allowDrawingArrows: true,
      clearArrowsOnPositionChange: true,
      // only the side to move can pick up pieces; tapping an enemy piece then captures it
      canDragPiece: ({ piece }: { piece: { pieceType: string } }) => piece.pieceType[0] === fen.split(' ')[1],
      // dragging shows the legal squares too, like a click does
      onPieceDrag: ({ square }: { square: string | null }) => {
        if (!onMove || !square) return;
        // pressing a target square of the selected piece is the second half of a click-move: keep the selection
        if (selected && targets.includes(square as Square)) return;
        dragFrom.current = square;
        setSelection({ fen, square: square as Square });
      },
      onPieceDrop: ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
        if (!targetSquare || targetSquare === sourceSquare) return false; // a tap: the click handler decides
        dragFrom.current = null;
        setSelection(null);
        return tryMove(sourceSquare as Square, targetSquare as Square);
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
      animationDurationInMs: 180,
      showNotation: !hideCoords,
    }),
    [id, fen, orientation, onMove, pending, selected, targets, tryMove, onSquareClick, boardArrows, squareStyles, squareRenderer, hideCoords],
  );

  return (
    <div className="board-box" style={{ maxWidth }} data-fen={fen} data-last-move={lastMove ? lastMove.from + lastMove.to : undefined}>
      <Chessboard options={options} />
      {pending && <PromotionPicker {...pending} orientation={orientation} onPick={(p) => { setPromo(null); onMove?.(pending.from, pending.to, p); }} onCancel={() => setPromo(null)} />}
    </div>
  );
});

/** The four pieces in a column over the promotion square, queen nearest the edge (as on chess.com). */
function PromotionPicker({ fen, to, orientation, onPick, onCancel }: { fen: string; to: Square; orientation: 'white' | 'black'; onPick: (p: Promotion) => void; onCancel: () => void }) {
  const color = fen.split(' ')[1] as 'w' | 'b';
  const file = to.charCodeAt(0) - 97;
  const col = orientation === 'white' ? file : 7 - file;
  const atTop = (to[1] === '8') === (orientation === 'white');
  const order: Promotion[] = ['q', 'n', 'r', 'b'];
  return (
    <div className="promo-backdrop" onClick={onCancel} role="dialog" aria-label="Choose a piece to promote to">
      <div className="promo-column" style={{ left: `${col * 12.5}%`, ...(atTop ? { top: 0 } : { bottom: 0, flexDirection: 'column-reverse' }) }} onClick={(e) => e.stopPropagation()}>
        {order.map((p) => (
          <button key={p} className="promo-piece" data-piece={p} aria-label={{ q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[p]} onClick={() => onPick(p)}>
            {defaultPieces[`${color}${p.toUpperCase()}`]?.({ svgStyle: { width: '100%', height: '100%' } })}
          </button>
        ))}
        <button className="promo-cancel" aria-label="Cancel" onClick={onCancel}>✕</button>
      </div>
    </div>
  );
}
