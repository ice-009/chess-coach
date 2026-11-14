import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Chessboard, defaultPieces } from 'react-chessboard';
import { Chess } from 'chess.js';
import type { Move, Square } from 'chess.js';
import type { Classification } from '../lib/analysis';
import { playSound } from '../lib/sound';
import { BOARD_THEMES, setBoardTheme, useBoardTheme } from '../lib/boardTheme';
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
  themePicker?: boolean; // the palette button in the corner (default: on boards wider than 300px)
}

// every colour comes from the board theme's CSS variables (src/index.css, "Board skin"), so switching theme is one attribute
const DARK = { backgroundColor: 'var(--b-dark-c)', backgroundImage: 'var(--b-dark)' };
const LIGHT = { backgroundColor: 'var(--b-light-c)', backgroundImage: 'var(--b-light)' };
const SQUARE = { boxShadow: 'var(--b-grid)' };
const NOTATION_DARK = { color: 'var(--b-note-dark)', fontWeight: 700 };
const NOTATION_LIGHT = { color: 'var(--b-note-light)', fontWeight: 700 };
const DROP = { boxShadow: 'inset 0 0 0 4px var(--b-drop)' };
const BOARD = { borderRadius: 'inherit' };
const LIFTED = { transform: 'scale(1.18) translateY(-6%)', filter: 'drop-shadow(0 14px 10px rgba(0,0,0,0.45))', cursor: 'grabbing' };
const GHOST = { opacity: 0.28 };
const LAST_MOVE = 'var(--b-last)';
const LAST_FROM = 'var(--b-last-from)';
const SELECTED = 'var(--b-sel)';
const DOT = 'var(--b-dot)';
const RING = 'var(--b-ring)';
const CHECK = 'var(--b-check)';
// pages mark the last move with chess.com's flat yellow: shown in the theme's own last-move colour instead
const themed = (bg: string) => (/^rgba\((255, ?255, ?51|250, ?204, ?21),/.test(bg) ? LAST_MOVE : bg);
const REDUCED_MOTION = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// solid-looking pieces: the library's piece drawings filled with ivory and ebony gradients and lit by a bevel
// filter (CSS in "Board skin"). The gradients and the filter are defined once for the whole page.
const PIECE_DEFS = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" focusable="false"><defs>
<linearGradient id="cca-pw" x1="0.1" y1="0" x2="0.45" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.4" stop-color="#f4ecd8"/><stop offset="1" stop-color="#b09d74"/></linearGradient>
<linearGradient id="cca-pb" x1="0.1" y1="0" x2="0.45" y2="1"><stop offset="0" stop-color="#8a90a6"/><stop offset="0.3" stop-color="#3a3f50"/><stop offset="1" stop-color="#0a0b10"/></linearGradient>
<filter id="cca-bevel" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
<feGaussianBlur in="SourceAlpha" stdDeviation="1.6" result="b"/>
<feSpecularLighting in="b" surfaceScale="5" specularConstant="1" specularExponent="18" lighting-color="#ffffff" result="s"><feDistantLight azimuth="235" elevation="42"/></feSpecularLighting>
<feComposite in="s" in2="SourceAlpha" operator="in" result="si"/>
<feComposite in="SourceGraphic" in2="si" operator="arithmetic" k2="1" k3="0.7"/>
</filter></defs></svg>`;
if (typeof document !== 'undefined' && !document.getElementById('cca-piece-defs')) {
  const holder = document.createElement('div');
  holder.id = 'cca-piece-defs';
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  holder.innerHTML = PIECE_DEFS;
  document.body.appendChild(holder);
}
const PIECES = Object.fromEntries(
  Object.entries(defaultPieces).map(([code, draw]) => [code, (props?: Parameters<typeof draw>[0]) => draw({ ...props, fill: code[0] === 'w' ? 'url(#cca-pw)' : 'url(#cca-pb)' })]),
) as typeof defaultPieces;

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
 * king in check, a piece picker for promotions, and a sound for every move. Colours come from the board theme
 * (src/lib/boardTheme.ts), picked with the palette button in the corner and shared by every board.
 */
export const Board = memo(function Board({ id, fen, orientation = 'white', arrows = [], squares = {}, badge, onMove, onSquare, hideCoords, maxWidth = 640, silent, themePicker = maxWidth > 300 }: Props) {
  const theme = useBoardTheme();
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
    if (lastMove) {
      out[lastMove.from] = { background: LAST_FROM };
      out[lastMove.to] = { background: LAST_MOVE };
    }
    for (const [sq, bg] of Object.entries(JSON.parse(squaresKey) as Record<string, string>)) {
      const shade = themed(bg);
      out[sq] = { background: shade === LAST_MOVE && sq === lastMove?.from ? LAST_FROM : shade };
    }
    if (checkSquare) out[checkSquare] = { ...out[checkSquare], backgroundImage: CHECK };
    if (selected) out[selected] = { background: SELECTED };
    for (const m of legal) out[m.to] = { ...out[m.to], backgroundImage: m.captured ? RING : DOT };
    return out;
  }, [squaresKey, lastMove, checkSquare, selected, legal]);

  // state classes for the theme's CSS: hover rings on targets, the check pulse, the landing flash
  const squareClasses = useMemo(() => {
    const out: Record<string, string> = {};
    const add = (sq: string, c: string) => (out[sq] = (out[sq] ?? 'board-sq') + ' ' + c);
    if (lastMove) {
      add(lastMove.from, 'is-left');
      add(lastMove.to, 'is-landed');
    }
    if (checkSquare) add(checkSquare, 'is-check');
    if (selected) add(selected, 'is-sel');
    for (const m of legal) add(m.to, m.captured ? 'is-capture' : 'is-target');
    return out;
  }, [lastMove, checkSquare, selected, legal]);

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

  // the selected piece, drawn faintly on a legal square while the pointer is over it
  const selPiece = useMemo(() => {
    const p = selected ? safeChess(fen)?.get(selected) : null;
    return p ? `${p.color}${p.type.toUpperCase()}` : null;
  }, [fen, selected]);

  const badgeSquare = badge?.square;
  const badgeClass = badge?.c;
  // a custom square renderer replaces the library's own square, which is what applies squareStyles: apply them here
  const squareRenderer = useCallback(
    ({ square, children }: { square: string; children?: ReactNode }) => (
      <div className={squareClasses[square] ?? 'board-sq'} style={{ position: 'relative', width: '100%', height: '100%', ...squareStyles[square] }}>
        {children}
        {selPiece && targets.includes(square as Square) && <span className="board-ghost" aria-hidden="true">{PIECES[selPiece]?.({ svgStyle: { width: '100%', height: '100%' } })}</span>}
        {square === badgeSquare && badgeClass && (
          <span className="board-badge">
            <ClassIcon c={badgeClass} size={26} />
          </span>
        )}
      </div>
    ),
    [badgeSquare, badgeClass, squareStyles, squareClasses, selPiece, targets],
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
      pieces: PIECES,
      squareStyles,
      squareRenderer,
      boardStyle: BOARD,
      squareStyle: SQUARE,
      darkSquareStyle: DARK,
      lightSquareStyle: LIGHT,
      darkSquareNotationStyle: NOTATION_DARK,
      lightSquareNotationStyle: NOTATION_LIGHT,
      dropSquareStyle: DROP,
      draggingPieceStyle: LIFTED,
      draggingPieceGhostStyle: GHOST,
      animationDurationInMs: 260,
      showAnimations: !REDUCED_MOTION,
      showNotation: !hideCoords,
    }),
    [id, fen, orientation, onMove, pending, selected, targets, tryMove, onSquareClick, boardArrows, squareStyles, squareRenderer, hideCoords],
  );

  return (
    <div
      className="board-box"
      style={{ maxWidth }}
      data-fen={fen}
      data-last-move={lastMove ? lastMove.from + lastMove.to : undefined}
      data-board-theme={theme}
      data-turn={onMove && !pending ? fen.split(' ')[1] : undefined}
    >
      <div className="board-well">
        <Chessboard options={options} />
        {pending && <PromotionPicker {...pending} orientation={orientation} onPick={(p) => { setPromo(null); onMove?.(pending.from, pending.to, p); }} onCancel={() => setPromo(null)} />}
      </div>
      {themePicker && <ThemePicker current={theme} />}
    </div>
  );
});

/** Palette button in the board's corner: a small popover of board themes, applied to every board at once. */
function ThemePicker({ current }: { current: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className={`board-theme${open ? ' open' : ''}`} ref={ref}>
      <button className="board-theme-btn" aria-label="Board theme" aria-expanded={open} title="Board theme" onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
          <path d="M12 3a9 9 0 0 0 0 18c1 0 1.6-.8 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.6-.4-1.1 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5C21 6.6 17 3 12 3Zm-5.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
        </svg>
      </button>
      {open && (
        <div className="board-theme-pop" role="menu" aria-label="Board theme">
          <div className="board-theme-title">Board</div>
          {BOARD_THEMES.map((t) => (
            <button key={t.id} role="menuitemradio" aria-checked={t.id === current} className={t.id === current ? 'on' : ''} onClick={() => setBoardTheme(t.id)}>
              <span className="board-theme-swatch" style={{ ['--sw-l' as string]: t.light, ['--sw-d' as string]: t.dark }} />
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
            {PIECES[`${color}${p.toUpperCase()}`]?.({ svgStyle: { width: '100%', height: '100%' } })}
          </button>
        ))}
        <button className="promo-cancel" aria-label="Cancel" onClick={onCancel}>✕</button>
      </div>
    </div>
  );
}
