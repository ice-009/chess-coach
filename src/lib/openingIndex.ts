import { OPENINGS } from '../data/openings';
import { parseLine } from './chess';

export interface BookHit {
  openingId: string;
  opening: string;
  lineId: string;
  line: string;
}

const key = (fen: string) => fen.split(' ').slice(0, 4).join(' ');
let index: Map<string, BookHit[]> | null = null;

function build() {
  const m = new Map<string, BookHit[]>();
  for (const o of OPENINGS) {
    if (o.group === 'traps') continue;
    for (const l of o.lines) {
      for (const n of parseLine(l.moves)) {
        const k = key(n.fenAfter);
        const hits = m.get(k) ?? [];
        if (!hits.some((h) => h.openingId === o.id)) hits.push({ openingId: o.id, opening: o.name, lineId: l.id, line: l.name });
        m.set(k, hits);
      }
    }
  }
  return m;
}

/** Repertoire openings that pass through this position. */
export function bookLookup(fen: string): BookHit[] {
  index ??= build();
  return index.get(key(fen)) ?? [];
}
