// Why a move is good: turns a move plus the engine's line into short, concrete reasons a club player can learn from
// (wins material, saves a piece, takes the open file, plants a knight on an outpost…), each linked to the lesson that teaches it.
import { Chess, SQUARES } from 'chess.js';
import type { Color, Move, PieceSymbol, Square } from 'chess.js';
import type { GameAnalysis, ParsedGame, PositionEval } from './analysis';
import { isLegalPosition } from './chess.ts';
import { PIECE_NAME, VALUE, forkTargets, lineText, materialBalance, phaseOf, playLine } from './tactics.ts';
import type { PlayedLine } from './tactics.ts';
import { THEME_LABEL, THEME_LESSON } from '../data/themes.ts';
import type { Theme } from '../data/themes.ts';

export { THEME_LABEL };
export type { Theme };

/** Finer ideas inside a theme, so hints can be more specific (a prophylactic move is still a 'defend'). */
export type ReasonKind = 'prophylaxis' | 'space' | 'worst-piece' | 'king-weakness' | 'simplify';

export interface Reason {
  theme: Theme;
  text: string;
  lesson?: string; // id of the lesson that teaches this idea
  kind?: ReasonKind;
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
export function passTurn(fen: string): string | null {
  const p = fen.split(' ');
  const f = [p[0], p[1] === 'w' ? 'b' : 'w', p[2], '-', p[4], p[5]].join(' ');
  return isLegalPosition(f) ? f : null;
}

/** A mating move for the side to move, if there is one. */
export function mateInOne(fen: string): string | null {
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

/** Castling moves the side to move could play right now. */
function castles(fen: string): string[] {
  try {
    return new Chess(fen).moves().filter((m) => m.startsWith('O-O')).map((m) => m.replace(/[+#]/g, ''));
  } catch {
    return [];
  }
}

/** The same position with `color` to move (or null if that is illegal), e.g. to ask what they could do next. */
function withTurn(fen: string, color: Color): string | null {
  return fen.split(' ')[1] === color ? fen : passTurn(fen);
}

/** A line piece on `sq` aiming at the enemy king or queen with one or two pieces in between (an x-ray). */
function xrayAt(c: Chess, sq: Square, color: Color): { target: PieceSymbol; line: string } | null {
  const p = c.get(sq);
  if (!p || (p.type !== 'b' && p.type !== 'r' && p.type !== 'q')) return null;
  const dirs = p.type === 'q' ? [...LINES.b, ...LINES.r] : LINES[p.type];
  for (const [df, dr] of dirs) {
    let f = fileIdx(sq) + df;
    let r = rankOf(sq) + dr;
    let between = 0;
    while (f >= 0 && f < 8 && r >= 1 && r <= 8) {
      const q = c.get(at(f, r));
      if (q) {
        if (q.color !== color && (q.type === 'k' || q.type === 'q') && between >= 1) {
          return { target: q.type, line: df === 0 ? `${sq[0]}-file` : dr === 0 ? `${sq[1]}th rank` : 'diagonal' };
        }
        if (++between > 2) break;
      }
      f += df;
      r += dr;
    }
  }
  return null;
}

/** How many squares a bishop on `sq` reaches. */
function bishopReach(c: Chess, sq: Square): number {
  let n = 0;
  for (const [df, dr] of LINES.b) {
    let f = fileIdx(sq) + df;
    let r = rankOf(sq) + dr;
    while (f >= 0 && f < 8 && r >= 1 && r <= 8) {
      n++;
      if (c.get(at(f, r))) break;
      f += df;
      r += dr;
    }
  }
  return n;
}

/** Squares the piece on `sq` can go to (empty or enemy-occupied), a rough measure of how active it is. */
function mobility(c: Chess, sq: Square, color: Color): number {
  let n = 0;
  for (const s of SQUARES) if (s !== sq && c.get(s)?.color !== color && c.attackers(s, color).includes(sq)) n++;
  return n;
}

function kingOf(c: Chess, color: Color): Square {
  return SQUARES.find((q) => c.get(q)?.type === 'k' && c.get(q)?.color === color)!;
}

const pawnCovered = (c: Chess, sq: Square, color: Color) => c.attackers(sq, color).some((a) => c.get(a)?.type === 'p');

/**
 * Forks `opp` could play in `fen` (opp to move) against `me`: a move after which the piece attacks two of
 * our pieces (or the king and a piece) on a square we don't attack, and at least two of them really hang.
 */
function forkThreats(fen: string, me: Color): { san: string; from: Square; to: Square; targets: PieceSymbol[] }[] {
  const c = new Chess(fen);
  const opp = other(me);
  const out: { san: string; from: Square; to: Square; targets: PieceSymbol[] }[] = [];
  for (const mv of c.moves({ verbose: true })) {
    c.move(mv);
    const targets = forkTargets(c, mv.to, opp);
    if (targets.length && !c.attackers(mv.to, me).length && !c.isCheckmate()) {
      const sqs = SQUARES.filter((q) => c.get(q)?.color === me && c.attackers(q, opp).includes(mv.to) && (c.get(q)!.type === 'k' || VALUE[c.get(q)!.type] >= 3));
      const hangs = sqs.filter((q) => {
        const t = c.get(q)!.type;
        return t === 'k' || (VALUE[t] > VALUE[mv.piece] && mv.piece !== 'k') || !c.attackers(q, me).length; // a king can only take what is undefended
      });
      if (hangs.length >= 2) out.push({ san: mv.san, from: mv.from, to: mv.to, targets: hangs.map((q) => c.get(q)!.type) });
    }
    c.undo();
  }
  return out;
}

/** Pawn pushes `opp` could play in `fen` (opp to move) that attack one of our pieces, on a square we can't win the pawn on. */
function pawnChases(fen: string, me: Color): { san: string; to: Square; target: Square }[] {
  const c = new Chess(fen);
  const out: { san: string; to: Square; target: Square }[] = [];
  for (const mv of c.moves({ verbose: true })) {
    if (mv.piece !== 'p' || mv.captured || mv.promotion) continue;
    c.move(mv);
    const hit = SQUARES.find((q) => c.get(q)?.color === me && ['n', 'b', 'r', 'q'].includes(c.get(q)!.type) && c.attackers(q, other(me)).includes(mv.to));
    const takers = c.attackers(mv.to, me);
    const safe = !takers.some((a) => c.get(a)?.type === 'p') && (!takers.length || c.attackers(mv.to, other(me)).length > 0);
    if (hit && safe) out.push({ san: mv.san, to: mv.to, target: hit });
    c.undo();
  }
  return out;
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

/** The line loses material for `me` within its first few moves (the move itself must not be a blunder to be praised). */
function losesMaterial(line: PlayedLine, me: Color, maxPlies = 6): boolean {
  const k = line.steps.slice(0, maxPlies).findLastIndex((s) => s.color !== me);
  if (k < 0) return false;
  const next = line.steps[k + 1]; // a capture we take straight back is not a loss
  const end = next?.captured && next.to === line.steps[k].to ? next : line.steps[k];
  return end.balance - line.start <= -1;
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
  const add = (theme: Theme, text: string, kind?: ReasonKind) => {
    if (!has(theme)) reasons.push({ theme, text, lesson: THEME_LESSON[theme], ...(kind && { kind }) });
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

  // ── defence: getting out of check, a piece that was under attack, or a mate threat ──
  if (before.inCheck() && !has('mate')) {
    const kingSq = SQUARES.find((q) => before.get(q)?.type === 'k' && before.get(q)?.color === me)!;
    const checkers = before.attackers(kingSq, opp);
    const noMoreChecks = !after.moves({ verbose: true }).some((x) => x.san.includes('+'));
    const only = before.moves().length === 1;
    if (m.captured && checkers.includes(m.to as Square)) {
      if (!has('material')) add('defend', `It answers the check by taking the ${name(m.captured)} that gave it${only ? ': the only move' : ''}.`);
    } else if (m.piece === 'k') add('defend', `${only ? 'It is the only move: the king must step' : 'The king steps'} out of check to ${m.to}${noMoreChecks ? ', where your opponent has no more checks' : ''}.`);
    else add('defend', `It blocks the check with your ${name(m.piece)}${only ? ': the only move' : ''}${noMoreChecks ? ', and no more checks follow' : ''}.`);
  }
  // prophylaxis: something the opponent could do if we passed (mate, a fork, a pawn chasing a piece) is gone after
  // the move. Checks and captures don't count: they stop everything for a move, which is not the same idea.
  const passed = before.inCheck() ? null : passTurn(fen);
  const quiet = !m.captured && !after.inCheck() && !losesMaterial(line, me);
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
    const threat = passed ? mateInOne(passed) : null;
    if (threat && !mateInOne(after.fen())) add('defend', `It stops ${threat.replace('#', '')}, which was threatening checkmate.`, quiet ? 'prophylaxis' : undefined);
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

  // ── prophylaxis: stopping the opponent's idea before it happens ──
  if (!has('defend', 'mate', 'material') && passed && quiet) {
    const forks = forkThreats(passed, me);
    if (forks.length && !forkThreats(after.fen(), me).length) {
      const f = forks.sort((a, b) => b.targets.length - a.targets.length)[0];
      const ts = [...f.targets].sort((a, b) => (a === 'k' ? -1 : b === 'k' ? 1 : VALUE[b] - VALUE[a]));
      add('defend', `It stops ${f.san} before it happens: that ${name(new Chess(passed).get(f.from)!.type)} move would have forked your ${listNames(ts)}.`, 'prophylaxis');
    }
  }
  if (!has('defend', 'mate', 'material') && passed && quiet) {
    const kick = pawnChases(passed, me).find((k) => k.target !== m.from && after.get(k.target)?.type === before.get(k.target)?.type && !pawnChases(after.fen(), me).some((x) => x.to === k.to));
    if (kick) add('defend', `It stops ${kick.san} before it happens: that pawn would have chased your ${name(before.get(kick.target)!.type)} away from ${kick.target}.`, 'prophylaxis');
  }
  if (phase !== 'opening' && m.piece === 'p' && quiet && !has('defend', 'mate', 'material')) {
    // "luft": a hole for the king, so a check on the back rank isn't mate
    const king = kingOf(before, me);
    const heavy = SQUARES.some((q) => after.get(q)?.color === opp && (after.get(q)?.type === 'r' || after.get(q)?.type === 'q'));
    const off = (f: string | null) => (f ? new Chess(f).moves({ verbose: true }).filter((x) => x.piece === 'k' && relRank(x.to, me) > 1).map((x) => x.to as Square) : []);
    if (heavy && relRank(king, me) === 1 && [0, 1, 2, 6, 7].includes(fileIdx(king)) && !off(withTurn(fen, me)).length && off(withTurn(after.fen(), me)).includes(m.from as Square))
      add('defend', `It gives your king an escape square on ${m.from}, so a check on the back rank is no longer automatically checkmate.`, 'prophylaxis');
  }

  // ── strategy ──
  const opening = phase === 'opening';
  const endgame = phase === 'endgame';
  if (m.san.startsWith('O-O')) add('castle', 'It castles: your king is safe behind its pawns and the rook comes toward the centre.');
  if (!m.san.startsWith('O-O') && !before.inCheck()) {
    // getting ready to castle: the pieces in between are out of the way now
    const mineAfter = withTurn(after.fen(), me);
    const mineBefore = withTurn(fen, me);
    const now = mineAfter ? castles(mineAfter) : [];
    const was = mineBefore ? castles(mineBefore) : [];
    const fresh = now.filter((x) => !was.includes(x));
    if (fresh.length && m.piece !== 'k' && m.piece !== 'r') add('castle', `It clears the way to castle ${fresh[0] === 'O-O' ? 'kingside' : 'queenside'}.`);
    // tucking the king away in the middlegame
    if (!endgame && m.piece === 'k' && [0, 1, 6, 7].includes(fileIdx(m.to)) && relRank(m.to, me) <= 2 && centreDistance(m.to) >= centreDistance(m.from))
      add('castle', `It tucks your king away on ${m.to}, further from the action, so later checks and pins are less likely.`);
  }
  if (opening && m.piece === 'p' && !m.captured) {
    // a pawn move that lets a bishop out
    for (const home of (me === 'w' ? ['c1', 'f1'] : ['c8', 'f8']) as Square[]) {
      const b = after.get(home);
      if (b?.type === 'b' && b.color === me && bishopReach(after, home) >= bishopReach(before, home) + 2) {
        add('develop', `It opens the diagonal for your bishop on ${home}.`);
        break;
      }
    }
  }
  if (!endgame && m.piece === 'p' && !m.captured && !has('center')) {
    const centre = (['d4', 'e4', 'd5', 'e5'] as Square[]).filter((q) => after.attackers(q, me).includes(m.to as Square) && !before.attackers(q, me).includes(m.from as Square));
    if (centre.length) add('center', `It fights for the centre: the pawn on ${m.to} controls ${centre.join(' and ')}.`);
  }
  if (!endgame && m.piece === 'p' && !m.captured && !m.promotion && relRank(m.to, me) >= 5 && !['d4', 'e4', 'd5', 'e5'].includes(m.to) && !has('center', 'threat') && !isPassed(after, m.to, me) && !losesMaterial(line, me)) {
    // gaining space: a safe pawn in the enemy half that takes squares from their pieces
    const dir = me === 'w' ? 1 : -1;
    const ahead = [-1, 1].map((df) => fileIdx(m.to) + df).filter((f) => f >= 0 && f < 8).map((f) => at(f, rankOf(m.to) + dir));
    const hits = ahead.some((q) => after.get(q)?.color === opp); // attacking something is a threat or a pawn break, not space
    const safe = !after.attackers(m.to, opp).some((a) => after.get(a)?.type === 'p') && !loosePieces(after, me).some((l) => l.sq === m.to);
    const taken = ahead.filter((q) => !after.get(q) && !pawnCovered(before, q, me));
    const users = taken.flatMap((q) => after.attackers(q, opp).filter((a) => ['n', 'b', 'r', 'q'].includes(after.get(a)!.type)));
    if (!hits && safe && taken.length && users.length) {
      const one = new Set(users).size === 1 ? `the ${name(after.get(users[0])!.type)} on ${users[0]}` : 'your opponent’s pieces';
      add('pawn-break', `It gains space: the pawn on ${m.to} takes ${taken.join(' and ')} away from ${one}. With more room your pieces move freely, while your opponent gets cramped.`, 'space');
    }
  }
  if (m.piece === 'p' && !m.captured && reasons.length === 0) {
    // taking a square away from an enemy piece that wanted to jump in there
    const dir = me === 'w' ? 1 : -1;
    for (const df of [-1, 1]) {
      const f = fileIdx(m.to) + df;
      if (f < 0 || f > 7) continue;
      const q = at(f, rankOf(m.to) + dir);
      if (relRank(q, me) < 4 || after.get(q)) continue;
      const jumper = after.attackers(q, opp).find((a) => ['n', 'b', 'q'].includes(after.get(a)!.type));
      if (jumper) {
        add('defend', `It takes the ${q} square away from the ${name(after.get(jumper)!.type)} on ${jumper}, so it can’t jump in there.`);
        break;
      }
    }
  }
  if ((m.piece === 'r' || m.piece === 'q' || m.piece === 'b') && !has('pin', 'mate', 'material')) {
    const x = xrayAt(after, m.to as Square, me);
    if (x && !xrayAt(before, m.from as Square, me))
      add('threat', `It lines your ${name(m.piece)} up with the enemy ${name(x.target)} on the ${x.line}: once the pieces in between move, the ${name(x.target)} is in the firing line.`);
  }
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
  if (['n', 'b', 'r', 'q'].includes(m.piece) && !opening && !has('mate', 'material', 'fork', 'outpost') && !losesMaterial(line, me)) {
    // improving the worst piece: the least active piece becomes a useful one
    const was = mobility(before, m.from, me);
    const now = mobility(after, m.to, me);
    const others = SQUARES.filter((q) => q !== m.from && before.get(q)?.color === me && ['n', 'b', 'r', 'q'].includes(before.get(q)!.type)).map((q) => mobility(before, q, me));
    const safe = !loosePieces(after, me).some((l) => l.sq === m.to);
    if (others.length >= 2 && was <= Math.min(...others) && was <= 4 && now >= was + 4 && now >= 2 * was && safe)
      add('improve', `It improves your worst piece: your ${name(m.piece)} had ${was === 0 ? 'no squares' : `only ${was} square${was === 1 ? '' : 's'}`} to go to on ${m.from}, and on ${m.to} it has ${now}.`, 'worst-piece');
  }
  if (m.piece === 'b' && !has('develop', 'outpost', 'improve')) {
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
  if (endgame && m.piece === 'k' && !has('king-activity') && !before.inCheck()) {
    const kd = (a: Square, b: Square) => Math.max(Math.abs(fileIdx(a) - fileIdx(b)), Math.abs(rankOf(a) - rankOf(b)));
    const passers = SQUARES.filter((q) => after.get(q)?.type === 'p' && isPassed(after, q, after.get(q)!.color));
    const target = passers.sort((a, b) => kd(m.to as Square, a) - kd(m.to as Square, b))[0];
    if (target && kd(m.to as Square, target) < kd(m.from as Square, target))
      add('king-activity', after.get(target)!.color === me ? `It brings your king closer to escort your passed pawn on ${target}.` : `It brings your king closer to stop the passed pawn on ${target}.`);
  }
  if (m.captured && m.piece !== 'p' && VALUE[m.captured] >= VALUE[m.piece] && Math.abs(gain) < 1 && materialBalance(before, me) >= 2 && line.steps[1]?.to === m.to)
    add('trade', `You are ahead in material, so trading ${m.captured === 'q' ? 'queens' : 'pieces'} helps: the fewer pieces are left, the easier your extra material wins.`, 'simplify');
  else if (!m.captured && m.piece !== 'p' && m.piece !== 'k' && !before.inCheck() && materialBalance(before, me) >= 2 && !has('mate', 'material', 'fork', 'threat') && !losesMaterial(line, me)) {
    // offering a trade: the moved piece stands defended, attacked only by an enemy piece of the same value
    const att = after.attackers(m.to, opp).map((a) => after.get(a)!.type);
    const offer = att.length > 0 && att.every((t) => VALUE[t] === VALUE[m.piece]) && after.attackers(m.to, me).length > 0;
    if (offer) add('trade', `You are ahead in material, so it offers a trade of ${att.every((t) => t === m.piece) ? `${name(m.piece)}s` : 'pieces'}: the fewer pieces are left, the easier your extra material wins.`, 'simplify');
  }
  if ((m.piece === 'n' || m.piece === 'r' || m.piece === 'q') && reasons.length < 2 && !opening && !has('mate', 'material', 'fork', 'open-file', 'seventh', 'outpost')) {
    const was = controls(before, m.from, me);
    const now = controls(after, m.to, me);
    if (now >= was + 4) add('improve', `It improves your ${name(m.piece)}: on ${m.to} it controls ${now} squares instead of ${was}.`);
  }
  if (m.san.includes('+') && reasons.length === 0) {
    const reply = line.steps[1];
    const kingMoves = reply?.piece === 'k';
    add('threat', kingMoves ? `It is a check that drives the king to ${reply.to}${centreDistance(reply.to) < 3 ? ', toward the middle of the board where it is exposed' : ''}.` : 'It is a check: your opponent must answer it before doing anything else, and you keep the initiative.');
  }
  return reasons.slice(0, 3);
}

/**
 * What is wrong with a move, beyond the engine's numbers: for now, pawn moves that weaken your own castled king.
 * Only meant for moves the engine didn't like; a good move can weaken the king for a good reason.
 */
export function drawbacks(fen: string, uci: string, opts: WhyOptions): Reason[] {
  const before = new Chess(fen);
  const after = new Chess(fen);
  let m: Move;
  try {
    m = after.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return [];
  }
  const me = m.color;
  const out: Reason[] = [];
  const king = kingOf(before, me);
  const kf = fileIdx(king);
  const shield = SQUARES.filter((q) => Math.abs(fileIdx(q) - kf) <= 1 && [2, 3].includes(relRank(q, me)) && before.get(q)?.type === 'p' && before.get(q)?.color === me);
  const castled = relRank(king, me) === 1 && [0, 1, 2, 6, 7].includes(kf) && shield.length >= 2;
  const queenLeft = SQUARES.some((q) => before.get(q)?.type === 'q' && before.get(q)?.color !== me);
  if (m.piece === 'p' && !m.captured && !m.san.includes('+') && castled && queenLeft && phaseOf(fen, opts.ply) !== 'endgame' && Math.abs(fileIdx(m.from) - kf) <= 1 && relRank(m.from, me) <= 3) {
    // squares next to the king that only a pawn guarded, and that no pawn can guard any more
    const zone = SQUARES.filter((q) => Math.abs(fileIdx(q) - kf) <= 1 && [2, 3].includes(relRank(q, me)));
    const holes = zone.filter((q) => pawnCovered(before, q, me) && !pawnCovered(after, q, me) && !(after.get(q)?.type === 'p' && after.get(q)?.color === me));
    if (holes.length)
      out.push({
        theme: 'castle',
        kind: 'king-weakness',
        lesson: THEME_LESSON.castle,
        text: `It weakens your king. With the pawn gone from ${m.from}, ${holes.join(' and ')} ${holes.length > 1 ? 'are' : 'is'} no longer guarded by a pawn, so enemy pieces can settle there next to your king.`,
      });
  }
  return out;
}

const SIDE: Record<Color, string> = { w: 'White', b: 'Black' };

/** A reason retold about `mover` in the third person ("White’s bishop…"), for moves the viewer didn’t play. */
export function aboutSide(text: string, mover: Color): string {
  const me = SIDE[mover];
  const them = SIDE[other(mover)];
  return text
    .replace(/your opponent’s/g, `${them}’s`)
    .replace(/your opponent/g, them)
    .replace(/You are ahead/g, `${me} is ahead`)
    .replace(/you keep/g, `${me} keeps`)
    .replace(/\byour\b/g, `${me}’s`);
}

export interface MoveWhy {
  san: string;
  uci: string;
  reasons: Reason[];
  drawbacks: Reason[]; // what was wrong with it, for moves the engine didn't choose
  line: string; // the engine's line from here, numbered SAN
  pv: string[]; // the same line in UCI, starting with this move
}

const moverMate = (e: PositionEval | undefined, me: Color) => (e && e.mate !== null ? (me === 'w' ? e.mate : -e.mate) : null);

function describe(fen: string, uci: string, pv: string[], ply: number, mate: number | null, flaws: boolean, viewer?: Color): MoveWhy {
  const me = fen.split(' ')[1] as Color;
  const steps = playLine(fen, pv, me, 8).steps;
  const voice = (rs: Reason[]) => (viewer && viewer !== me ? rs.map((r) => ({ ...r, text: aboutSide(r.text, me) })) : rs);
  return {
    san: steps[0]?.san ?? uci,
    uci,
    reasons: voice(whyMove(fen, uci, pv, { ply, mate })),
    drawbacks: flaws ? voice(drawbacks(fen, uci, { ply })) : [],
    line: lineText(fen, steps, 8),
    pv,
  };
}

/**
 * Reasons for the move played at index i and, when the engine preferred another move, for that move (and what
 * was wrong with the move played). With `viewer`, the other side's moves are told in the third person.
 */
export function explainChoice(game: ParsedGame, analysis: GameAnalysis, i: number, viewer?: Color): { played: MoveWhy; best: MoveWhy | null; reply: string | null } {
  const fen = game.fens[i];
  const me = game.moves[i].color;
  const before = analysis.evals[i];
  const after = analysis.evals[i + 1];
  const playedUci = game.moves[i].uci;
  const isBest = before?.bestMove === playedUci;
  const playedPv = isBest && before.pv?.length ? before.pv : [playedUci, ...(after?.pv ?? [])];
  const left = moverMate(after, me);
  const played = describe(fen, playedUci, playedPv, i, isBest ? moverMate(before, me) : left !== null && left > 0 ? left + 1 : null, !isBest && !!before?.bestMove, viewer);
  const bestUci = before?.bestMove;
  const best = !isBest && bestUci ? describe(fen, bestUci, before.pv?.[0] === bestUci ? before.pv : [bestUci], i, moverMate(before, me), false, viewer) : null;
  // the opponent's best answer to the move played: often the clearest way to see what it allowed
  const reply = !isBest && after?.pv?.[0] ? playLine(game.fens[i + 1], after.pv.slice(0, 1), me, 1).steps[0]?.san ?? null : null;
  return { played, best, reply };
}
