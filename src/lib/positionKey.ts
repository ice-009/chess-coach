// Position hashing shared by the database build (Node), its server API and the on-device database (browser).
import { Chess } from 'chess.js';

/** 53-bit string hash (cyrb53): fits exactly in a JS number and in a SQLite INTEGER. */
export function hash53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** Key of a position: placement, side to move, castling and en-passant (move counters ignored). */
export function positionKey(fen: string): number {
  return hash53(fen.split(' ').slice(0, 4).join(' '));
}

/** Normalizes any FEN the way chess.js writes it, so every side hashes identically. */
export function normalizeFen(fen: string): string | null {
  try {
    return new Chess(fen).fen();
  } catch {
    return null;
  }
}
