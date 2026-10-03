// Parses PGN files into compact game records with position keys (runs in a worker thread).
import fs from 'node:fs';
import { parentPort, workerData } from 'node:worker_threads';
import { Chess } from 'chess.js';
import { MAX_PLY, loadOpenings, nameKey, positionKey, resultCode, sanTokens, splitPgn } from './common.ts';

export interface GameRecord {
  source: string;
  white: string;
  black: string;
  whiteNk: string;
  blackNk: string;
  whiteFide: string;
  blackFide: string;
  whiteElo: number;
  blackElo: number;
  whiteTitle: string;
  blackTitle: string;
  result: number;
  date: string;
  year: number;
  event: string;
  site: string;
  round: string;
  eco: string;
  opening: string;
  online: number; // 1 = played on the internet (chess.com, lichess, …), 0 = over the board
  speed: 'classical' | 'rapid' | 'blitz';
  moves: string; // SAN, space separated
  plies: number;
  keys: number[]; // position key at ply 0..n (n ≤ MAX_PLY)
  next: (string | null)[]; // move played from each keyed position (null = game ended there)
  dedupe: string;
}

const { minElo } = workerData as { minElo: number };

const openings = loadOpenings();

function parseGame(headers: Record<string, string>, movetext: string, source: string): GameRecord | null {
  const result = resultCode(headers.Result);
  if (result === null) return null;
  const whiteElo = Number(headers.WhiteElo) || 0;
  const blackElo = Number(headers.BlackElo) || 0;
  // TWIC also covers open tournaments: keep only games where both players are master-level
  if (source === 'twic' && (whiteElo < minElo || blackElo < minElo)) return null;
  if (headers.SetUp === '1' || headers.FEN) return null; // non-standard start positions
  const event = headers.Event ?? '';
  const site = headers.Site ?? '';
  // engine tournaments (TCEC, CCC…) are not human master games
  if (/tcec|\bccc\b|computer|engine/i.test(`${event} ${site}`) || /stockfish|leela|lc0|komodo|dragon|reckless|torch|berserk|obsidian/i.test(`${headers.White} ${headers.Black}`)) return null;
  const online = /\bINT\b|chess\.com|lichess|chess24|internet|online|titled (tue|arena)|bullet/i.test(`${event} ${site}`) ? 1 : 0;
  // speed from the event name ("Titled Tue" is TWIC's abbreviation of Titled Tuesday), or from a time control
  // written in it ("1st 3-0 Thu", "5+2") or in a TimeControl tag (seconds, e.g. "180+2")
  const tcInName = event.match(/\b(\d{1,2})\s?[-+]\s?(\d{1,2})\b/) ?? event.match(/\b(\d{1,2})'()/); // "3-0", "5+2", "5'"
  const tcTag = (headers.TimeControl ?? '').match(/^(\d+)(?:\+(\d+))?$/);
  const minutes = tcInName ? Number(tcInName[1]) + Number(tcInName[2] || 0) * 2 / 3 : tcTag ? (Number(tcTag[1]) + Number(tcTag[2] ?? 0) * 40) / 60 : null;
  const speed: GameRecord['speed'] =
    /blitz|bullet|titled (tue|arena)|armageddon|speed ?chess|chess\.com speed/i.test(event) || (minutes !== null && minutes < 10) ? 'blitz'
    : /rapid/i.test(event) || (minutes !== null && minutes < 60) ? 'rapid'
    : 'classical';
  const tokens = sanTokens(movetext);
  if (tokens.length < 4) return null;

  const c = new Chess();
  const keys = [positionKey(c.fen())];
  const next: (string | null)[] = [];
  const sans: string[] = [];
  let opening: { eco: string; name: string } | undefined = openings.get(keys[0]);
  for (let i = 0; i < tokens.length; i++) {
    if (i < MAX_PLY) {
      let m;
      try {
        m = c.move(tokens[i]);
      } catch {
        if (i < 10) return null;
        break; // keep the valid part of a damaged game
      }
      sans.push(m.san);
      next.push(m.san);
      const k = positionKey(c.fen());
      keys.push(k);
      opening = openings.get(k) ?? opening;
    } else {
      sans.push(tokens[i]); // beyond the indexed depth the moves are stored as written
    }
  }
  if (keys.length > next.length) next.push(sans.length > next.length ? sans[next.length] : null);

  const date = headers.Date ?? '';
  const year = Number(date.slice(0, 4)) || 0;
  const white = (headers.White ?? '?').trim();
  const black = (headers.Black ?? '?').trim();
  return {
    source,
    white,
    black,
    whiteNk: nameKey(white),
    blackNk: nameKey(black),
    whiteFide: headers.WhiteFideId ?? '',
    blackFide: headers.BlackFideId ?? '',
    whiteElo,
    blackElo,
    whiteTitle: headers.WhiteTitle ?? '',
    blackTitle: headers.BlackTitle ?? '',
    result,
    date,
    year,
    event,
    site,
    online,
    speed,
    round: headers.Round ?? '',
    eco: headers.ECO || opening?.eco || '',
    opening: opening?.name || [headers.Opening, headers.Variation].filter(Boolean).join(': '),
    moves: sans.join(' '),
    plies: sans.length,
    keys,
    next,
    dedupe: `${nameKey(white)}|${nameKey(black)}|${year}|${sans.slice(0, 40).join(' ')}`,
  };
}

parentPort!.on('message', (msg: { file: string; source: string } | null) => {
  if (!msg) return process.exit(0);
  // most files are UTF-8, older ones Latin-1: fall back when UTF-8 decoding hits invalid bytes
  const buf = fs.readFileSync(msg.file);
  let text = buf.toString('utf8');
  if (text.includes('\uFFFD')) text = buf.toString('latin1');
  const games = splitPgn(text);
  const records: GameRecord[] = [];
  for (const g of games) {
    const r = parseGame(g.headers, g.movetext, msg.source);
    if (r) records.push(r);
  }
  parentPort!.postMessage({ file: msg.file, parsed: games.length, records });
});
