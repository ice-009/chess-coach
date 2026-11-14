// Your games against the bots: the score against each one (synced) and the last games (this device), so any
// of them can be reviewed later.
import { Chess } from 'chess.js';
import { KEYS, load, save } from './storage';
import type { Classification, ParsedGame } from './analysis';

export interface BotRecord {
  w: number;
  d: number;
  l: number;
}

export interface BotGame {
  id: string;
  bot: string; // bot slug
  you: 'w' | 'b';
  startFen: string;
  sans: string[];
  outcome: 'win' | 'loss' | 'draw';
  reason: string;
  date: number;
  tc: string | null; // "5+3", or null without a clock
  coach: boolean;
  grades?: (Classification | null)[];
  takebacks?: number;
}

const MAX_GAMES = 60;

export const botRecords = () => load<Record<string, BotRecord>>(KEYS.botRecord, {});
export const botGames = () => load<BotGame[]>(KEYS.botGames, []);
export const findBotGame = (id: string) => botGames().find((g) => g.id === id);

export function saveBotGame(g: BotGame): void {
  save(KEYS.botGames, [g, ...botGames().filter((x) => x.id !== g.id)].slice(0, MAX_GAMES));
  const rec = botRecords();
  const r = rec[g.bot] ?? { w: 0, d: 0, l: 0 };
  const k = g.outcome === 'win' ? 'w' : g.outcome === 'loss' ? 'l' : 'd';
  save(KEYS.botRecord, { ...rec, [g.bot]: { ...r, [k]: r[k] + 1 } });
}

/** A game rebuilt for the review board. */
export function parsedBotGame(g: { startFen: string; sans: string[] }): ParsedGame {
  const c = new Chess(g.startFen);
  const fens = [c.fen()];
  const moves: ParsedGame['moves'] = [];
  for (const san of g.sans) {
    const m = c.move(san);
    moves.push({ san: m.san, uci: m.from + m.to + (m.promotion ?? ''), from: m.from, to: m.to, color: m.color, captured: !!m.captured });
    fens.push(c.fen());
  }
  return { fens, moves };
}

/** The game as PGN, e.g. to open it in another program. */
export function botGamePgn(g: BotGame, botName: string): string {
  const c = new Chess(g.startFen);
  const start = new Chess().fen();
  if (g.startFen !== start) {
    c.setHeader('SetUp', '1');
    c.setHeader('FEN', g.startFen);
  }
  const white = g.you === 'w' ? 'You' : botName;
  const black = g.you === 'b' ? 'You' : botName;
  c.setHeader('Event', 'ChessCoach bot game');
  c.setHeader('White', white);
  c.setHeader('Black', black);
  c.setHeader('Date', new Date(g.date).toISOString().slice(0, 10).replace(/-/g, '.'));
  for (const san of g.sans) c.move(san);
  const res = g.outcome === 'draw' ? '1/2-1/2' : (g.outcome === 'win') === (g.you === 'w') ? '1-0' : '0-1';
  c.setHeader('Result', res);
  return c.pgn();
}
