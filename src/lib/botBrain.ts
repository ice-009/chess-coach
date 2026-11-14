// The bots' personalities and how they choose a move. Pure (chess.js only) so the calibration script and the
// tests can run it in Node: the browser side (bot.ts) supplies Stockfish's candidate moves.
import { Chess } from 'chess.js';
import type { Move, Square } from 'chess.js';
import { forkTargets } from './tactics.ts';

export type Style = 'balanced' | 'attacker' | 'solid' | 'trickster' | 'gambiteer' | 'grinder';

export interface Level {
  id: number;
  name: string;
  note: string;
  depth: number;
  multiPv: number;
  temperature: number; // centipawns: how far from the best move it is willing to stray
  blunder: number; // chance per move of a lapse: it doesn't look at your replies, so a piece it leaves hanging looks fine
  miss?: number; // chance per move it doesn't notice a piece you leave hanging or a fork it could play
  natural?: number; // centipawns: how much it likes natural-looking moves (captures, checks, development) whatever they're worth
  style?: Style;
  book?: string[][]; // opening lines (SAN from the start position) it likes to play
}

export interface Bot extends Level {
  slug: string;
  rating: number; // approximate strength (see scripts/calibrate-bots.ts)
  avatar: string;
  tone: 'green' | 'blue' | 'orange' | 'purple' | 'cyan' | 'pink' | 'gold' | 'red';
  style: Style;
  bio: string;
  greet: string;
  onWin: string; // the bot won
  onLose: string; // you won
  onBlunder: string; // you just left something hanging
}

export const STYLE_LABEL: Record<Style, string> = {
  balanced: 'All-rounder',
  attacker: 'Attacker',
  solid: 'Solid',
  trickster: 'Trickster',
  gambiteer: 'Gambiteer',
  grinder: 'Endgame grinder',
};

/** Fixed-strength levels: the drills use the strongest as best defence. */
export const LEVELS: Level[] = [
  { id: 1, name: 'Beginner', note: 'Misses simple tactics often', depth: 5, multiPv: 6, temperature: 260, blunder: 0.22 },
  { id: 2, name: 'Novice', note: 'Plays sensibly but blunders', depth: 6, multiPv: 5, temperature: 160, blunder: 0.12 },
  { id: 3, name: 'Casual', note: 'A typical online club player', depth: 8, multiPv: 4, temperature: 90, blunder: 0.06 },
  { id: 4, name: 'Club', note: 'Solid, occasional slips', depth: 10, multiPv: 3, temperature: 50, blunder: 0.03 },
  { id: 5, name: 'Strong club', note: 'Punishes most mistakes', depth: 12, multiPv: 3, temperature: 25, blunder: 0.01 },
  { id: 6, name: 'Expert', note: 'Very few mistakes', depth: 14, multiPv: 2, temperature: 10, blunder: 0 },
  { id: 7, name: 'Master', note: 'Full strength, quick', depth: 16, multiPv: 1, temperature: 0, blunder: 0 },
  { id: 8, name: 'Maximum', note: 'Best defence (used in drills)', depth: 20, multiPv: 1, temperature: 0, blunder: 0 },
];

const L = (s: string) => s.split(' ');

/**
 * The bot ladder, weakest first. Ratings are measured by scripts/calibrate-bots.ts against Stockfish held to a UCI_Elo
 * (and, below its 1320 floor, through the neighbours), so they are rough: about ±100.
 */
export const BOTS: Bot[] = [
  {
    id: 101, slug: 'pip', name: 'Pip', rating: 400, avatar: '🐣', tone: 'gold', style: 'balanced',
    depth: 1, multiPv: 30, temperature: 240, blunder: 0.6, miss: 0.75, natural: 170,
    note: 'Just learned how the pieces move', bio: 'Pip loves moving the queen out early and often forgets pieces can be taken.',
    greet: 'Hi! I just learned how the horsey moves. Be nice!', onWin: 'Wait… I won?! Yay!', onLose: 'Good game! You’re really good.', onBlunder: 'Ooh, is that piece for me?',
    book: [L('e4 e5 Qh5'), L('e4 e5 Bc4 Nc6 Qf3'), L('d4 d5 Qd3')],
  },
  {
    id: 102, slug: 'milo', name: 'Milo', rating: 600, avatar: '🐢', tone: 'green', style: 'solid',
    depth: 2, multiPv: 26, temperature: 180, blunder: 0.5, miss: 0.65, natural: 150,
    note: 'Slow and steady, hangs a piece now and then', bio: 'Milo likes to keep everything protected, but checks and captures still surprise him.',
    greet: 'Slow and steady wins the race. Let’s play!', onWin: 'Slow and steady!', onLose: 'You were too quick for me.', onBlunder: 'Hmm, I think I can take that.',
    book: [L('e4 e5 Nf3 Nc6 Nc3 Nf6'), L('d4 d5 Nf3 Nf6 e3 e6')],
  },
  {
    id: 103, slug: 'riya', name: 'Riya', rating: 800, avatar: '🌸', tone: 'pink', style: 'balanced',
    depth: 3, multiPv: 22, temperature: 140, blunder: 0.42, miss: 0.55, natural: 120,
    note: 'Knows the opening rules, misses tactics', bio: 'Riya develops her pieces and castles early. She is still learning to spot forks.',
    greet: 'Knights before bishops, castle early. Ready?', onWin: 'That was fun! Want a rematch?', onLose: 'Nicely played! I’ll get you next time.', onBlunder: 'Did you mean to leave that there?',
    book: [L('e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6'), L('d4 d5 c4 e6 Nc3 Nf6'), L('e4 c6 d4 d5')],
  },
  {
    id: 104, slug: 'kai', name: 'Kai', rating: 1000, avatar: '🏄', tone: 'cyan', style: 'attacker',
    depth: 4, multiPv: 18, temperature: 100, blunder: 0.28, miss: 0.4, natural: 90,
    note: 'Goes for your king, leaves holes behind', bio: 'Kai rides every attacking wave: checks, sacrifices and pawn storms. Defend first, then hit back.',
    greet: 'Your king looks lonely over there. 🤙', onWin: 'Wipeout! Gnarly game.', onLose: 'Respect, you held the wave.', onBlunder: 'Sweet, free stuff!',
    book: [L('e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5'), L('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6'), L('e4 e5 Nf3 Nc6 d4 exd4 Bc4')],
  },
  {
    id: 105, slug: 'nora', name: 'Nora', rating: 1200, avatar: '📚', tone: 'blue', style: 'solid',
    depth: 5, multiPv: 14, temperature: 90, blunder: 0.24, miss: 0.34, natural: 70,
    note: 'Plays the London and waits for your mistake', bio: 'Nora is a librarian who plays the same solid setup every game and punishes loose pieces.',
    greet: 'Shh. Let’s have a quiet, solid game.', onWin: 'Patience pays off.', onLose: 'Well earned. Good technique.', onBlunder: 'That piece isn’t protected, you know.',
    book: [L('d4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3'), L('d4 Nf6 Bf4 g6 e3 Bg7 Nf3'), L('e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5'), L('d4 d5 c4 c6 Nf3 Nf6')],
  },
  {
    id: 106, slug: 'viktor', name: 'Viktor', rating: 1400, avatar: '🎩', tone: 'purple', style: 'trickster',
    depth: 6, multiPv: 12, temperature: 75, blunder: 0.18, miss: 0.26, natural: 55,
    note: 'Sets traps everywhere', bio: 'Viktor knows every opening trap in the book. If something looks free, check twice.',
    greet: 'Shall we see if you fall for my little tricks?', onWin: 'A magician never reveals his secrets.', onLose: 'Bravo. You saw through me.', onBlunder: 'Ah, merci!',
    book: [L('e4 e5 Nf3 Nf6 Nxe5 Nc6'), L('e4 e5 Nf3 Nc6 Bc4 Nd4'), L('d4 e5'), L('e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6 d4')],
  },
  {
    id: 107, slug: 'gia', name: 'Gia', rating: 1600, avatar: '🔥', tone: 'orange', style: 'gambiteer',
    depth: 7, multiPv: 10, temperature: 55, blunder: 0.11, miss: 0.17, natural: 40,
    note: 'Sacrifices pawns for fast development', bio: 'Gia gives up pawns for open lines and an attack. Take the gift only if you can survive the storm.',
    greet: 'A pawn? Take it. I dare you. 🔥', onWin: 'Fortune favours the bold!', onLose: 'You weathered the storm. Impressive.', onBlunder: 'Now that’s a real gift!',
    book: [L('e4 e5 f4'), L('e4 e5 d4 exd4 c3'), L('d4 Nf6 c4 e5'), L('d4 d5 c4 e5'), L('e4 c5 d4 cxd4 c3')],
  },
  {
    id: 108, slug: 'hugo', name: 'Hugo', rating: 1900, avatar: '🏰', tone: 'green', style: 'grinder',
    depth: 8, multiPv: 8, temperature: 45, blunder: 0.07, miss: 0.11, natural: 25,
    note: 'Trades down and grinds endgames', bio: 'Hugo is happy to trade queens on move 10 and squeeze you for 60 moves. Know your endgames.',
    greet: 'Let’s trade down and see who knows endgames.', onWin: 'The endgame never lies.', onLose: 'Excellent technique. Well done.', onBlunder: 'Every pawn counts.',
    book: [L('d4 Nf6 c4 e6 Nc3 Bb4'), L('c4 e5 Nc3 Nf6 Nf3 Nc6'), L('e4 e6 d4 d5 Nc3 Nf6'), L('e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4')],
  },
  {
    id: 109, slug: 'mira', name: 'Mira', rating: 2400, avatar: '👑', tone: 'gold', style: 'balanced',
    depth: 9, multiPv: 5, temperature: 38, blunder: 0.035, miss: 0.035, natural: 12,
    note: 'Master strength: rarely blunders', bio: 'Mira plays main-line theory and punishes almost every mistake. Beating her is a real achievement.',
    greet: 'Good luck. Play your best.', onWin: 'Good game. Review it: there was a turning point.', onLose: 'Very impressive. You earned that.', onBlunder: 'Careful.',
    book: [L('e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7'), L('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'), L('d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7')],
  },
  {
    id: 110, slug: 'titan', name: 'Titan', rating: 3100, avatar: '🤖', tone: 'red', style: 'balanced',
    depth: 16, multiPv: 1, temperature: 0, blunder: 0,
    note: 'Stockfish at full speed', bio: 'Titan is the engine itself, searching millions of positions. A draw is a great result.',
    greet: 'CALCULATING. GOOD LUCK, HUMAN.', onWin: 'RESULT: 1-0. AS EXPECTED.', onLose: 'ERROR. THIS WAS NOT IN MY CALCULATIONS.', onBlunder: 'MATERIAL ADVANTAGE DETECTED.',
  },
];

export const findBot = (slug: string) => BOTS.find((b) => b.slug === slug);

/**
 * The ladder: a bot opens once you've beaten or drawn the one just below it (or already scored against it). Pip is
 * always open. Returns the bot to beat first, or null when it's open. `records` is botRecords() (slug → { w, d, l }).
 */
export function lockedBy(slug: string, records: Record<string, { w: number; d: number } | undefined>, unlockAll = false): Bot | null {
  const i = BOTS.findIndex((b) => b.slug === slug);
  if (i <= 0 || unlockAll) return null;
  const scored = (s: string) => (records[s]?.w ?? 0) + (records[s]?.d ?? 0) > 0;
  return scored(BOTS[i - 1].slug) || scored(slug) ? null : BOTS[i - 1];
}

export interface Candidate {
  uci: string;
  score: number; // centipawns for the side to move (mate scores large)
}

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const fileOf = (sq: string) => sq.charCodeAt(0) - 97;
const rankOf = (sq: string) => Number(sq[1]);
const dist = (a: string, b: string) => Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));

function kingSquare(c: Chess, color: 'w' | 'b'): string {
  for (const row of c.board()) for (const p of row) if (p && p.type === 'k' && p.color === color) return p.square;
  return 'e1';
}

/** Taste, in centipawns: how much a style likes a move beyond what the engine thinks of it. */
export function styleBonus(fen: string, uci: string, style: Style | undefined): number {
  if (!style || style === 'balanced') return 0;
  const c = new Chess(fen);
  let m: Move;
  try {
    m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return 0;
  }
  const me = m.color;
  const opp = me === 'w' ? 'b' : 'w';
  const ply = (Number(fen.split(' ')[5]) - 1) * 2 + (me === 'b' ? 1 : 0);
  const enemyKing = kingSquare(c, opp);
  const ahead = (() => {
    let s = 0;
    for (const row of c.board()) for (const p of row) if (p) s += (p.color === me ? 1 : -1) * VALUE[p.type];
    return s;
  })();
  const trade = !!m.captured && VALUE[m.captured] === VALUE[m.piece] && m.piece !== 'p';
  const intoEnemyHalf = me === 'w' ? rankOf(m.to) >= 5 : rankOf(m.to) <= 4;
  const closer = dist(m.to, enemyKing) < dist(m.from, enemyKing);
  // the attacks it now makes on pieces worth more than the attacker
  let threats = 0;
  for (const row of c.board())
    for (const p of row)
      if (p && p.color === opp && p.type !== 'k' && VALUE[p.type] > VALUE[m.piece] && c.attackers(p.square, me).includes(m.to as Square)) threats++;
  switch (style) {
    case 'attacker':
      return (m.san.includes('+') ? 35 : 0) + (m.captured ? 12 : 0) + (intoEnemyHalf ? 10 : 0) + (closer && m.piece !== 'k' ? 12 : 0) + (m.piece === 'p' && dist(m.to, enemyKing) <= 2 ? 15 : 0);
    case 'solid':
      return (m.san.startsWith('O-O') ? 45 : 0) + (trade && ahead >= 0 ? 18 : 0) + (m.san.includes('+') ? -5 : 0) + (m.piece === 'q' && ply < 14 ? -30 : 0);
    case 'trickster':
      return threats * 28 + (m.san.includes('+') ? 15 : 0) + (m.piece === 'q' && ply < 14 ? 10 : 0);
    case 'gambiteer':
      return (ply < 20 && m.piece === 'p' && !m.captured ? 12 : 0) + (ply < 20 && (m.piece === 'n' || m.piece === 'b') && (me === 'w' ? rankOf(m.from) === 1 : rankOf(m.from) === 8) ? 18 : 0) + (m.san.includes('+') ? 15 : 0) + (closer ? 6 : 0);
    case 'grinder': {
      const endgameKing = m.piece === 'k' && dist(m.to, 'e4') + dist(m.to, 'd5') < dist(m.from, 'e4') + dist(m.from, 'd5') && c.board().flat().filter((p) => p && p.type === 'q').length === 0;
      return (trade ? 30 : 0) + (m.captured === 'q' && m.piece === 'q' ? 40 : 0) + (endgameKing ? 25 : 0);
    }
  }
  return 0;
}

/** A book move for this bot, if the game so far (SAN from the start) is the start of one of its lines. */
export function bookMove(level: Level, history: string[] | undefined, rand = Math.random): string | null {
  if (!level.book || !history) return null;
  const options = level.book.filter((line) => line.length > history.length && history.every((s, i) => line[i] === s)).map((line) => line[history.length]);
  if (!options.length || rand() > 0.92) return null; // now and then it leaves its book, like people do
  const san = options[Math.floor(rand() * options.length)];
  const c = new Chess();
  try {
    for (const s of history) c.move(s);
    const m = c.move(san);
    return m.from + m.to + (m.promotion ?? '');
  } catch {
    return null;
  }
}

// ── Human-like mistakes: what a weaker player fails to see ──

const play = (fen: string, uci: string): { c: Chess; m: Move } | null => {
  const c = new Chess(fen);
  try {
    return { c, m: c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }) };
  } catch {
    return null;
  }
};

/** What a capture wins at a glance (pawns): the piece taken, less the capturer if the square is defended. */
function captureGain(c: Chess, m: Move): number {
  if (!m.captured) return 0;
  const defended = c.attackers(m.to, m.color === 'w' ? 'b' : 'w').length > 0;
  return VALUE[m.captured] - (defended ? VALUE[m.piece] : 0);
}

/** The most the side to move can win at once with one capture: something left hanging. */
export function hangingValue(fen: string): number {
  const c = new Chess(fen);
  let best = 0;
  for (const m of c.moves({ verbose: true })) best = Math.max(best, captureGain(c, m));
  return best;
}

/** What `uci` leaves en prise (pawns), net of what it took: the material a lapse doesn't see. */
export function hangsAfter(fen: string, uci: string): number {
  const r = play(fen, uci);
  if (!r) return 0;
  return Math.max(0, hangingValue(r.c.fen()) - (r.m.captured ? VALUE[r.m.captured] : 0));
}

/** What `uci` wins that the opponent offered (pawns): a loose piece taken, or a fork of two big pieces. */
export function offerTaken(fen: string, uci: string): number {
  const r = play(fen, uci);
  if (!r) return 0;
  const gain = captureGain(new Chess(fen), r.m);
  const forked = r.m.piece !== 'k' && !r.c.isAttacked(r.m.to, r.c.turn()) ? forkTargets(r.c, r.m.to, r.m.color) : [];
  return Math.max(gain, forked.length ? Math.min(...forked.map((t) => (t === 'k' ? 9 : VALUE[t]))) : 0);
}

/** How natural a move looks (0 to about 2): captures, checks, castling and developing a piece catch the eye. */
export function naturalness(fen: string, uci: string): number {
  const r = play(fen, uci);
  if (!r) return 0;
  const { m } = r;
  const ply = (Number(fen.split(' ')[5]) - 1) * 2 + (m.color === 'b' ? 1 : 0);
  const home = m.color === 'w' ? '1' : '8';
  let n = 0;
  if (m.captured) n += 1;
  if (m.san.includes('+')) n += 0.8;
  if (m.san.startsWith('O-O')) n += 0.7;
  if (ply < 20 && (m.piece === 'n' || m.piece === 'b') && m.from[1] === home) n += 0.6;
  if (ply < 10 && m.piece === 'p' && 'de'.includes(m.from[0])) n += 0.4;
  if (m.piece !== 'p' && m.to[1] === home && m.from[1] !== home && !m.captured) n -= 0.4; // going backwards rarely looks right
  return n;
}

/**
 * Picks among the engine's candidates (best first) by how good the move *looks to the bot*: Stockfish's score, plus
 * the style's taste, plus a liking for natural moves; on a lapse it doesn't see what its move leaves hanging (or a mate
 * against it), and on a miss it doesn't see what you offered. Then a softmax by how much worse each move looks.
 * Deterministic for a given `rand`, which it calls exactly three times plus once to pick.
 */
export function chooseMove(fen: string, cands: Candidate[], level: Level, rand = Math.random): Candidate {
  if (cands.length === 1 || level.temperature === 0) return cands[0];
  const lapse = rand() < level.blunder;
  const miss = rand() < (level.miss ?? 0);
  const pick = rand();
  const best = cands[0].score;
  const seen = cands.map((c) => {
    if (Math.abs(c.score) > 5000) {
      // a mate it walks into goes unseen in a lapse; otherwise never trade a mate for taste
      return lapse && c.score < 0 && best > -5000 ? best - 150 : c.score;
    }
    let s = c.score + styleBonus(fen, c.uci, level.style) + (level.natural ?? 0) * naturalness(fen, c.uci);
    if (lapse) s += Math.min(100 * hangsAfter(fen, c.uci), Math.max(0, best - c.score)); // looks as good as it would without the loss
    if (miss) s -= 100 * offerTaken(fen, c.uci);
    return s;
  });
  const top = Math.max(...seen);
  const weights = seen.map((s) => Math.exp(-Math.min(2000, top - s) / level.temperature));
  let x = pick * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cands.length; i++) {
    x -= weights[i];
    if (x <= 0) return cands[i];
  }
  return cands[0];
}

/** How long the bot "thinks" (ms): stronger bots and longer time controls think longer; never more than its clock allows. */
export function thinkTime(level: Level, clockMs: number | null, rand = Math.random): number {
  if (clockMs === null) return 450;
  const share = (clockMs / 35) * (0.5 + level.depth / 32); // a share of what's left; stronger bots take longer
  const t = share * (0.4 + rand() * 1.2);
  return Math.max(250, Math.min(t, 12_000, clockMs * 0.25));
}
