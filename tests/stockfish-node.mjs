// Stockfish in Node for tests: analyses a game the way the app does (evaluations from White's side, mate as
// ±10000 centipawns, best move and main line per position).
import { spawn } from 'node:child_process';
import { Chess } from 'chess.js';

export async function engine() {
  const sf = spawn('node', ['node_modules/stockfish/bin/stockfish.js']);
  let buf = '';
  let waiting = null;
  sf.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      waiting?.(line);
    }
  });
  const send = (s) => sf.stdin.write(s + '\n');
  const until = (pred) => new Promise((res) => { const lines = []; waiting = (l) => { lines.push(l); if (pred(l)) { waiting = null; res(lines); } }; });
  send('uci');
  await until((l) => l === 'uciok');
  send('setoption name Threads value 4');
  send('isready');
  await until((l) => l === 'readyok');

  async function evaluate(fen, depth = 12) {
    const c = new Chess(fen);
    const white = c.turn() === 'w' ? 1 : -1;
    if (c.isCheckmate()) return { cp: -white * 10000, mate: 0, bestMove: null };
    if (c.isDraw()) return { cp: 0, mate: null, bestMove: null };
    send(`position fen ${fen}`);
    send(`go depth ${depth}`);
    const lines = await until((l) => l.startsWith('bestmove'));
    let cp = 0, mate = null, pv = [];
    for (const l of lines) {
      const m = l.match(/score (cp|mate) (-?\d+).* pv (.+)$/);
      if (!m) continue;
      if (m[1] === 'cp') { cp = Number(m[2]) * white; mate = null; } else { mate = Number(m[2]) * white; cp = (mate > 0 ? 10000 : -10000); }
      pv = m[3].split(' ');
    }
    return { cp, mate, bestMove: lines.at(-1).split(' ')[1], pv: pv.slice(0, 8) };
  }

  /** ParsedGame + a GameAnalysis-shaped object ({ evals }) for a PGN. */
  async function analyse(pgn, depth = 12) {
    const chess = new Chess();
    chess.loadPgn(pgn);
    const h = chess.history({ verbose: true });
    const fens = [h[0]?.before ?? chess.fen(), ...h.map((m) => m.after)];
    const moves = h.map((m) => ({ san: m.san, uci: m.from + m.to + (m.promotion ?? ''), from: m.from, to: m.to, color: m.color, captured: !!m.captured }));
    const toSec = (c) => c.split(':').reduce((a, x) => a * 60 + Number(x), 0);
    const clocks = [...pgn.matchAll(/%clk\s+([\d:.]+)/g)].map((m) => toSec(m[1]));
    const tc = pgn.match(/\[TimeControl "(\d+)(?:\+(\d+))?"\]/);
    const evals = [];
    for (const f of fens) evals.push(await evaluate(f, depth));
    return {
      game: { fens, moves, clocks: clocks.length === moves.length ? clocks : undefined, timeControl: tc ? { base: Number(tc[1]), inc: Number(tc[2] ?? 0) } : undefined },
      analysis: { evals, reviews: [], accuracy: { w: 0, b: 0 }, acpl: { w: 0, b: 0 }, depth },
    };
  }
  return { evaluate, analyse, quit: () => send('quit') };
}
