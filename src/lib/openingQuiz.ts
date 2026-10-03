// Opening quiz: the computer plays book moves from every line in scope (choosing a different line each round),
// you play your side from memory. Results are kept per line and colour.
import { ENCYCLOPEDIA, ENC_GROUPS } from '../data/encyclopedia';
import { GROUPS, OPENINGS } from '../data/openings';
import type { Opening } from '../data/openings';
import { parseLine } from './chess';
import type { MoveNode } from './chess';
import { KEYS, load, save } from './storage';

export type Color = 'w' | 'b';

export interface QuizLine {
  id: string;
  name: string;
  opening: Opening;
  moves: MoveNode[];
}

export interface LineResult {
  passed: boolean;
  misses: number;
  date: number;
}

type Results = Record<string, Partial<Record<Color, LineResult>>>;

/** What a quiz covers: one opening, a section, the whole repertoire or the whole encyclopedia. */
export function quizScope(scope: string): { title: string; openings: Opening[] } {
  if (scope === 'repertoire') return { title: 'My repertoire', openings: OPENINGS.filter((o) => o.group !== 'traps') };
  if (scope === 'encyclopedia') return { title: 'Opening encyclopedia', openings: ENCYCLOPEDIA };
  const group = [...GROUPS, ...ENC_GROUPS].find((g) => g.id === scope);
  if (group) return { title: group.title, openings: [...OPENINGS, ...ENCYCLOPEDIA].filter((o) => o.group === scope) };
  const one = [...OPENINGS, ...ENCYCLOPEDIA].find((o) => o.id === scope);
  return { title: one?.name ?? 'Openings', openings: one ? [one] : [] };
}

export const quizLines = (openings: Opening[]): QuizLine[] =>
  openings.flatMap((o) => o.lines.map((l) => ({ id: l.id, name: l.name, opening: o, moves: parseLine(l.moves) })));

export type QuizMode = Color | 'mixed' | 'own';

export const ownColor = (l: QuizLine): Color => (l.opening.side === 'white' ? 'w' : 'b');

/** The side these openings are learned from: one colour if they agree, otherwise each line from its own side. */
export function defaultMode(openings: Opening[]): QuizMode {
  const sides = new Set(openings.map((o) => o.side));
  return sides.size === 1 ? (sides.has('white') ? 'w' : 'b') : 'own';
}

export const loadResults = (): Results => load<Results>(KEYS.openingQuiz, {});

export function saveResult(lineId: string, color: Color, misses: number) {
  const all = loadResults();
  all[lineId] = { ...all[lineId], [color]: { passed: misses === 0, misses, date: Date.now() } };
  save(KEYS.openingQuiz, all);
}

/** Order for a session: lines never quizzed first, then lines you failed, then the ones passed longest ago. */
export function sessionOrder(lines: QuizLine[], color: Color | 'own', results = loadResults()): QuizLine[] {
  const c = (l: QuizLine) => (color === 'own' ? ownColor(l) : color);
  const rank = (l: QuizLine) => {
    const r = results[l.id]?.[c(l)];
    return !r ? 0 : !r.passed ? 1 : 2;
  };
  return [...lines]
    .map((l) => ({ l, k: rank(l), d: results[l.id]?.[c(l)]?.date ?? 0, rnd: Math.random() }))
    .sort((a, b) => a.k - b.k || a.d - b.d || a.rnd - b.rnd)
    .map((x) => x.l);
}

/** Passed as this colour: every line of the opening was played without a miss the last time. */
export function openingPassed(o: Opening, color: Color, results = loadResults()): boolean {
  return o.lines.every((l) => results[l.id]?.[color]?.passed);
}

/**
 * Lines that agree with the moves played so far (the computer may have chosen any of them, and you may
 * have picked any of their moves at a branch point).
 */
export const consistent = (lines: QuizLine[], played: string[]) =>
  lines.filter((l) => l.moves.length > played.length && played.every((u, i) => l.moves[i].uci === u));
