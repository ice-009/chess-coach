// Why a move is good: turns a move plus the engine's line into short, concrete reasons a club player can learn from
// (wins material, saves a piece, takes the open file, plants a knight on an outpost…), each linked to the lesson that teaches it.
import { Chess, SQUARES } from 'chess.js';
import type { Color, Move, PieceSymbol, Square } from 'chess.js';
import type { GameAnalysis, ParsedGame, PositionEval } from './analysis';
import { isLegalPosition } from './chess';
import { PIECE_NAME, VALUE, lineText, materialBalance, phaseOf, playLine } from './tactics';
import type { PlayedLine } from './tactics';
import { THEME_LABEL, THEME_LESSON } from '../data/themes';
import type { Theme } from '../data/themes';

export { THEME_LABEL };
export type { Theme };

export interface Reason {
  theme: Theme;
  text: string;
  lesson?: string; // id of the lesson that teaches this idea
}

const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');
const fileIdx = (sq: Square) => sq.charCodeAt(0) - 97;
const rankOf = (sq: Square) => Number(sq[1]);
const relRank = (sq: Square, c: Color) => (c === 'w' ? rankOf(sq) : 9 - rankOf(sq));
const name = (t: PieceSymbol) => PIECE_NAME[t];
const at = (f: number, r: number) => `${String.fromCharCode(97 + f)}${r}` as Square;
const isLight = (sq: Square) => (fileIdx(sq) + rankOf(sq)) % 2 === 0;
const KING_VALUE = 100;

function valueOn(c: Chess, sq: Square): number {
  const p = c.get(sq);
  return !p ? 0 : p.type === 'k' ? KING_VALUE : VALUE[p.type];
}

interface Loose {
  sq: Square;
  type: PieceSymbol;
  gain: number; // what the other side wins by taking it (rough, one exchange deep)
  attacker: PieceSymbol; // cheapest piece attacking it
  defended: boolean;
}

/** Pieces of `color` the other side could win right now: undefended ones, or ones attacked by something cheaper. */
function loosePieces(c: Chess, color: Color): Loose[] {
  const enemy = other(color);
  const out: Loose[] = [];
  for (const row of c.board()) {
    for (const p of row) {
      if (!p || p.color !== color || p.type === 'k') continue;
      const att = c.attackers(p.square, enemy);
      if (!att.length) continue;
      const cheapest = att.reduce((a, b) => (valueOn(c, b) < valueOn(c, a) ? b : a));
      const minAtt = valueOn(c, cheapest);
      const defended = c.attackers(p.square, color).length > 0;
      const v = VALUE[p.type];
      const gain = !defended ? v : minAtt < v ? v - minAtt : 0;
      if (gain >= 1) out.push({ sq: p.square, type: p.type, gain, attacker: c.get(cheapest)!.type, defended });
    }
  }
  return out.sort((a, b) => b.gain - a.gain);
}

/** The same position with the other side to move (a "pass"), or null when that would be illegal. */
function passTurn(fen: string): string | null {
  const p = fen.split(' ');
  const f = [p[0], p[1] === 'w' ? 'b' : 'w', p[2], '-', p[4], p[5]].join(' ');
  return isLegalPosition(f) ? f : null;
}

/** A mating move for the side to move, if there is one. */
function mateInOne(fen: string): string | null {
  const c = new Chess(fen);
  for (const m of c.moves({ verbose: true })) {
    c.move(m);
    const mate = c.isCheckmate();
    c.undo();
    if (mate) return m.san;
  }
  return null;
}

/** How many squares the piece on `sq` attacks or defends. */
function controls(c: Chess, sq: Square, color: Color): number {
  let n = 0;
  for (const s of SQUARES) if (s !== sq && c.attackers(s, color).includes(sq)) n++;
  return n;
}

function enemyPawns(c: Chess, color: Color): Square[] {
  const out: Square[] = [];
  for (const row of c.board()) for (const p of row) if (p && p.type === 'p' && p.color !== color) out.push(p.square);
  return out;
}

/** No enemy pawn in front of it on its own or a neighbouring file. */
function isPassed(c: Chess, sq: Square, color: Color): boolean {
  return !enemyPawns(c, color).some((e) => Math.abs(fileIdx(e) - fileIdx(sq)) <= 1 && (color === 'w' ? rankOf(e) > rankOf(sq) : rankOf(e) < rankOf(sq)));
}

/** No enemy pawn can ever attack this square (none left on the neighbouring files in front of it). */
function pawnProof(c: Chess, sq: Square, color: Color): boolean {
  return !enemyPawns(c, color).some((e) => Math.abs(fileIdx(e) - fileIdx(sq)) === 1 && (color === 'w' ? rankOf(e) > rankOf(sq) : rankOf(e) < rankOf(sq)));
}

function fileStatus(c: Chess, file: number, color: Color): 'open' | 'half-open' | 'closed' {
  let own = 0;
  let theirs = 0;
  for (let r = 1; r <= 8; r++) {
    const p = c.get(at(file, r));
    if (p?.type === 'p') {
      if (p.color === color) own++;
      else theirs++;
    }
  }
  return own ? 'closed' : theirs ? 'half-open' : 'open';
}

const LINES: Record<'b' | 'r', [number, number][]> = {
  b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
};

/** A line piece on `sq` pinning an enemy piece to its king or to something more valuable. */
function pinBy(c: Chess, sq: Square, color: Color): { pinned: Square; type: PieceSymbol; behind: PieceSymbol } | null {
  const p = c.get(sq);
  if (!p || (p.type !== 'b' && p.type !== 'r' && p.type !== 'q')) return null;
  const dirs = p.type === 'q' ? [...LINES.b, ...LINES.r] : LINES[p.type];
  for (const [df, dr] of dirs) {
    let f = fileIdx(sq) + df;
    let r = rankOf(sq) + dr;
    let first: { sq: Square; type: PieceSymbol } | null = null;
    while (f >= 0 && f < 8 && r >= 1 && r <= 8) {
      const q = c.get(at(f, r));
      if (q) {
        if (!first) {
          if (q.color === color || q.type === 'k' || q.type === 'p') break;
          first = { sq: at(f, r), type: q.type };
        } else {
          if (q.color !== color && (q.type === 'k' || VALUE[q.type] > VALUE[first.type])) return { pinned: first.sq, type: first.type, behind: q.type };
          break;
        }
      }
      f += df;
      r += dr;
    }
  }
  return null;
}

const centreDistance = (sq: Square) => Math.max(Math.abs(fileIdx(sq) - 3.5), Math.abs(rankOf(sq) - 4.5));
const onLongDiagonal = (sq: Square) => fileIdx(sq) === rankOf(sq) - 1 || fileIdx(sq) + rankOf(sq) === 8;
const listNames = (ts: PieceSymbol[]) => ts.map(name).join(' and ');

/** "Bad" bishop: most of your pawns stand on its colour and block it. */
function isBadBishop(c: Chess, sq: Square, color: Color): boolean {
  let same = 0;
  let total = 0;
  for (const row of c.board()) {
    for (const p of row) {
      if (!p || p.type !== 'p' || p.color !== color) continue;
      total++;
      if (isLight(p.square) === isLight(sq)) same++;
    }
  }
  return same >= 3 && same >= total * 0.6;
}

/**
 * Material won within the first few moves of the line, measured after the opponent's replies (so a capture
 * they can take straight back doesn't count). `plies` is how much of the line it takes to show the gain.
 */
export function wonInLine(line: PlayedLine, me: Color, maxPlies = 6): { gain: number; plies: number } {
  const replies = line.steps.slice(0, maxPlies).flatMap((s, k) => (s.color !== me ? [{ k, gain: s.balance - line.start }] : []));
  const final = replies.at(-1)?.gain ?? 0;
  if (final < 1) return { gain: 0, plies: 0 };
  let j = replies.length - 1;
  while (j > 0 && replies[j - 1].gain >= final) j--; // the first reply from which we stay ahead
  return { gain: final, plies: replies[j].k + 1 };
}

function gainText(gain: number, steps: PlayedLine['steps'], me: Color): string {
  if (gain >= 8) return 'the queen';
  if (gain >= 5) return 'a rook';
  if (gain >= 3) return 'a piece';
  if (gain === 2) {
    const mine = steps.filter((s) => s.color === me && s.captured).map((s) => s.captured);
    const theirs = steps.filter((s) => s.color !== me && s.captured).map((s) => s.captured);
    return mine.includes('r') && (theirs.includes('n') || theirs.includes('b')) ? 'the exchange (a rook for a minor piece)' : 'two pawns';
  }
  return 'a pawn';
}

export interface WhyOptions {
  ply: number; // index of the move in the game, to tell opening from middlegame
  mate?: number | null; // the mover forces mate in this many moves (counting this one), if the engine says so
}

/**
 * Reasons why `uci` is a good move in `fen`, strongest first (at most three). `pv` is the engine's line
 * starting with this move; it is used to see what the move wins or threatens a few moves later.
 */
export function whyMove(fen: string, uci: string, pv: string[], opts: WhyOptions): Reason[] {
  const before = new Chess(fen);
  const after = new Chess(fen);
  let m: Move;
  try {
    m = after.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return [];
  }
  const me = before.turn();
  const opp = other(me);
  const line = playLine(fen, pv[0] === uci ? pv : [uci], me, 8);
  const phase = phaseOf(fen, opts.ply);
  const reasons: Reason[] = [];
  const has = (...themes: Theme[]) => reasons.some((r) => themes.includes(r.theme));
  const add = (theme: Theme, text: string) => {
    if (!has(theme)) reasons.push({ theme, text, lesson: THEME_LESSON[theme] });
  };
  const lineStr = (plies = 6) => lineText(fen, line.steps, plies);

  // ── tactics: mate, material, forks ──
  if (after.isCheckmate()) add('mate', 'It is checkmate.');
  else if (opts.mate && opts.mate > 0) add('mate', `It forces checkmate in ${opts.mate}: ${lineStr(opts.mate * 2 - 1)}${line.steps.length < opts.mate * 2 - 1 ? ' …' : ''}.`);

  const won = wonInLine(line, me);
  const gain = won.gain;
  const looseBefore = loosePieces(before, opp);
  const target = m.captured ? looseBefore.find((l) => l.sq === m.to) : undefined;
  const unverified = line.steps.length < 2; // no engine reply to check the capture against
  if (!has('mate') && (gain >= 1 || (unverified && target))) {
    // a fork that actually collects: our next move takes one of the forked pieces with the forking piece
    const fork = line.steps.find((s, k) => s.color === me && s.fork.length && line.steps[k + 2]?.from === s.to && line.steps[k + 2]?.captured);
    if (target && !target.defended) add('material', `It takes the undefended ${name(target.type)} on ${target.sq}.`);
    else if (target) add('material', `It wins material: your ${name(m.piece)} takes the more valuable ${name(target.type)} on ${target.sq}.`);
    else if (fork) {
      const prize = fork.fork.filter((t) => t !== 'k').sort((a, b) => VALUE[b] - VALUE[a])[0];
      const targets = [...fork.fork].sort((a, b) => (a === 'k' ? -1 : b === 'k' ? 1 : VALUE[b] - VALUE[a]));
      add('fork', `${fork === line.steps[0] ? `It is a ${name(fork.piece)} fork` : `It sets up ${fork.san}, a ${name(fork.piece)} fork`} of the ${listNames(targets)}${prize ? `: the ${name(prize)} falls` : ''} (${lineStr(line.steps.indexOf(fork) + 3)}).`);
    }
    else add('material', `It wins ${gainText(gain, line.steps.slice(0, won.plies), me)} by force: ${lineStr(won.plies)}.`);
  }

  // ── defence: a piece that was under attack, or a mate threat ──
  if (!before.inCheck()) {
    const looseAfter = loosePieces(after, me);
    for (const t of loosePieces(before, me)) {
      const moved = m.from === t.sq;
      const now = moved ? m.to : t.sq;
      if (!moved && after.get(t.sq)?.type !== t.type) continue;
      if (looseAfter.some((l) => l.sq === now) || gain < 0) continue;
      const why = t.defended ? `a ${name(t.attacker)} was attacking it` : 'it was attacked and undefended';
      add('defend', moved ? `It saves your ${name(t.type)}: on ${t.sq} ${why}.` : `It protects your ${name(t.type)} on ${t.sq}: ${why}.`);
      break;
    }
    const passed = passTurn(fen);
    const threat = passed ? mateInOne(passed) : null;
    if (threat && !mateInOne(after.fen())) add('defend', `It stops ${threat.replace('#', '')}, which was threatening checkmate.`);
  }

  // ── new threats: pins, attacks on loose pieces ──
  const pin = !has('mate') ? pinBy(after, m.to, me) : null; // pinned pawns rarely matter, so only pieces count
  if (pin) add('pin', `It pins the ${name(pin.type)} on ${pin.pinned} to the ${name(pin.behind)}${pin.behind === 'k' ? ', so it can’t move' : ''}.`);
  if (!has('mate', 'material', 'fork')) {
    const t = loosePieces(after, opp).find(
      (l) => !looseBefore.some((b) => b.sq === l.sq) && after.attackers(l.sq, me).includes(m.to) && (l.type !== 'p' || m.piece !== 'p'), // pawn hits pawn is a pawn break, below
    );
    if (t) add('threat', `It attacks the ${name(t.type)} on ${t.sq}${t.defended ? '' : ', which has no defender'}, so your opponent has to react.`);
  }

  // ── strategy ──
  const opening = phase === 'opening';
  const endgame = phase === 'endgame';
  if (m.san.startsWith('O-O')) add('castle', 'It castles: your king is safe behind its pawns and the rook comes toward the centre.');
  if (opening && (m.piece === 'n' || m.piece === 'b') && relRank(m.from, me) === 1)
    add('develop', `It develops your ${name(m.piece)}${centreDistance(m.to) < centreDistance(m.from) ? ' toward the centre' : ''}, bringing another piece into the game.`);
  if (!endgame && m.piece === 'p' && !m.captured && ['d4', 'e4', 'd5', 'e5'].includes(m.to))
    add('center', `It puts a pawn in the centre on ${m.to}, gaining space and taking squares away from your opponent’s pieces.`);

  if (m.piece === 'r' && fileIdx(m.from) !== fileIdx(m.to)) {
    const st = fileStatus(after, fileIdx(m.to), me);
    if (st !== 'closed') {
      const partner = SQUARES.some((s) => s !== m.to && s[0] === m.to[0] && after.get(s)?.color === me && (after.get(s)?.type === 'r' || after.get(s)?.type === 'q'));
      add('open-file', `It puts your rook on the ${st} ${m.to[0]}-file${partner ? ', doubling your heavy pieces' : ''}. Rooks belong on open files, where they can reach the enemy position${st === 'half-open' ? ' and press against the enemy pawn on it' : ''}.`);
    }
  }
  if (m.piece === 'p' && m.captured && fileStatus(after, fileIdx(m.from), me) !== 'closed' && SQUARES.some((s) => after.get(s)?.color === me && (after.get(s)?.type === 'r' || after.get(s)?.type === 'q')))
    add('open-file', `It opens the ${m.from[0]}-file for your rooks.`);
  if ((m.piece === 'r' || m.piece === 'q') && relRank(m.to, me) === 7 && relRank(m.from, me) !== 7) {
    const targets = SQUARES.some((s) => relRank(s, me) === 7 && after.get(s)?.color === opp && after.get(s)?.type === 'p');
    const kingBack = SQUARES.some((s) => relRank(s, me) === 8 && after.get(s)?.color === opp && after.get(s)?.type === 'k');
    if (targets || kingBack) add('seventh', `It puts your ${name(m.piece)} on the 7th rank, where it attacks pawns from the side${kingBack ? ' and keeps the king trapped on the back rank' : ''}.`);
  }
  if ((m.piece === 'n' || m.piece === 'b') && [4, 5, 6].includes(relRank(m.to, me)) && pawnProof(after, m.to, me) && after.attackers(m.to, me).some((s) => after.get(s)?.type === 'p'))
    add('outpost', `It puts your ${name(m.piece)} on an outpost on ${m.to}: a pawn protects it and no enemy pawn can ever chase it away.`);
  if (m.piece === 'b' && !has('develop', 'outpost')) {
    if (m.captured && m.captured !== 'p' && isBadBishop(before, m.from, me)) add('bishop', 'It trades off your “bad” bishop, the one hemmed in by your own pawns on its colour.');
    else {
      const was = controls(before, m.from, me);
      const now = controls(after, m.to, me);
      if (now >= was + 3 && now >= 7) add('bishop', `It activates your bishop: on ${m.to} it controls ${now} squares instead of ${was}${onLongDiagonal(m.to) ? ', along the long diagonal' : ''}.`);
    }
  }
  if (m.piece === 'p') {
    if (m.promotion) add('passed-pawn', `It promotes the pawn to a ${name(m.promotion)}.`);
    else if (isPassed(after, m.to, me))
      add('passed-pawn', isPassed(before, m.from, me) ? 'It pushes your passed pawn closer to promotion: passed pawns must be pushed.' : `It creates a passed pawn on ${m.to}: no enemy pawn can stop it any more.`);
    else if (!m.captured && !has('center')) {
      const dir = me === 'w' ? 1 : -1;
      const hit = [-1, 1]
        .map((df) => fileIdx(m.to) + df)
        .filter((f) => f >= 0 && f < 8)
        .map((f) => at(f, rankOf(m.to) + dir))
        .find((s) => after.get(s)?.type === 'p' && after.get(s)?.color === opp);
      if (hit) add('pawn-break', `It is a pawn break: it attacks the pawn on ${hit} to open lines for your pieces.`);
    }
  }
  if (endgame && m.piece === 'k' && centreDistance(m.to) < centreDistance(m.from))
    add('king-activity', 'It brings your king toward the centre: in the endgame the king is a strong fighting piece.');
  if (m.captured && m.piece !== 'p' && VALUE[m.captured] >= VALUE[m.piece] && Math.abs(gain) < 1 && materialBalance(before, me) >= 2 && line.steps[1]?.to === m.to)
    add('trade', 'You are ahead in material, so trading pieces helps: the fewer pieces are left, the easier your extra material wins.');
  if ((m.piece === 'n' || m.piece === 'r' || m.piece === 'q') && reasons.length < 2 && !opening && !has('mate', 'material', 'fork', 'open-file', 'seventh', 'outpost')) {
    const was = controls(before, m.from, me);
    const now = controls(after, m.to, me);
    if (now >= was + 4) add('improve', `It improves your ${name(m.piece)}: on ${m.to} it controls ${now} squares instead of ${was}.`);
  }
  return reasons.slice(0, 3);
}

export interface MoveWhy {
  san: string;
  uci: string;
  reasons: Reason[];
  line: string; // the engine's line from here, numbered SAN
  pv: string[]; // the same line in UCI, starting with this move
}

const moverMate = (e: PositionEval | undefined, me: Color) => (e && e.mate !== null ? (me === 'w' ? e.mate : -e.mate) : null);

function describe(fen: string, uci: string, pv: string[], ply: number, mate: number | null): MoveWhy {
  const me = fen.split(' ')[1] as Color;
  const steps = playLine(fen, pv, me, 8).steps;
  return { san: steps[0]?.san ?? uci, uci, reasons: whyMove(fen, uci, pv, { ply, mate }), line: lineText(fen, steps, 8), pv };
}

/** Reasons for the move played at index i and, when the engine preferred another move, for that move. */
export function explainChoice(game: ParsedGame, analysis: GameAnalysis, i: number): { played: MoveWhy; best: MoveWhy | null; reply: string | null } {
  const fen = game.fens[i];
  const me = game.moves[i].color;
  const before = analysis.evals[i];
  const after = analysis.evals[i + 1];
  const playedUci = game.moves[i].uci;
  const isBest = before?.bestMove === playedUci;
  const playedPv = isBest && before.pv?.length ? before.pv : [playedUci, ...(after?.pv ?? [])];
  const left = moverMate(after, me);
  const played = describe(fen, playedUci, playedPv, i, isBest ? moverMate(before, me) : left !== null && left > 0 ? left + 1 : null);
  const bestUci = before?.bestMove;
  const best = !isBest && bestUci ? describe(fen, bestUci, before.pv?.[0] === bestUci ? before.pv : [bestUci], i, moverMate(before, me)) : null;
  // the opponent's best answer to the move played: often the clearest way to see what it allowed
  const reply = !isBest && after?.pv?.[0] ? playLine(game.fens[i + 1], after.pv.slice(0, 1), me, 1).steps[0]?.san ?? null : null;
  return { played, best, reply };
}
