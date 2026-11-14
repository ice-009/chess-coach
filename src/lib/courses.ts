// Courses: the app's lessons, puzzle themes, drills, openings and bots put in order, as a path you can follow
// from start to finish. Each step ticks itself off from the progress the app already keeps.
import { KEYS, load, save } from './storage';
import { findLesson } from '../data/lessons';
import { findDrill } from '../data/drills';
import { findOpening } from '../data/openings';
import { THEMES } from './puzzles';
import { findBot } from './botBrain';

export type Step =
  | { kind: 'lesson'; id: string }
  | { kind: 'puzzles'; theme: string; count: number }
  | { kind: 'drill'; id: string }
  | { kind: 'opening'; id: string }
  | { kind: 'safety'; count: number }
  | { kind: 'bot'; bot: string }; // beat this bot once

export interface Course {
  id: string;
  title: string;
  tagline: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  rating: string; // who it's for
  icon: string;
  tone: 'green' | 'blue' | 'orange' | 'purple' | 'cyan' | 'pink' | 'gold' | 'red';
  chapters: { title: string; steps: Step[] }[];
}

const lesson = (id: string): Step => ({ kind: 'lesson', id });
const puzzles = (theme: string, count = 10): Step => ({ kind: 'puzzles', theme, count });
const drill = (id: string): Step => ({ kind: 'drill', id });
const opening = (id: string): Step => ({ kind: 'opening', id });
const bot = (slug: string): Step => ({ kind: 'bot', bot: slug });
const safety = (count: number): Step => ({ kind: 'safety', count });

export const COURSES: Course[] = [
  {
    id: 'foundations', title: 'Chess Foundations', tagline: 'From how the pieces move to your first checkmates and your first win against a bot.',
    level: 'Beginner', rating: 'New to chess', icon: '🧱', tone: 'blue',
    chapters: [
      { title: 'The rules', steps: [lesson('what-is-chess'), lesson('pieces'), lesson('special-rules')] },
      { title: 'Your first checkmates', steps: [puzzles('mateIn1', 10), drill('queen-mate'), drill('rook-mate')] },
      { title: 'Starting the game', steps: [lesson('opening-rules'), opening('italian')] },
      { title: 'Graduation', steps: [bot('pip'), bot('milo')] },
    ],
  },
  {
    id: 'blunders', title: 'Stop Blundering', tagline: 'The habit that decides most games below 1200: check every move before you play it.',
    level: 'Beginner', rating: '400–1000', icon: '🛑', tone: 'red',
    chapters: [
      { title: 'The blunder check', steps: [lesson('blunder-check'), safety(20), puzzles('hangingPiece', 15)] },
      { title: 'Defending', steps: [puzzles('defensiveMove', 10), safety(50)] },
      { title: 'Your clock', steps: [lesson('time'), lesson('review-games')] },
      { title: 'Prove it', steps: [bot('riya'), bot('kai')] },
    ],
  },
  {
    id: 'tactics', title: 'Tactics Bootcamp', tagline: 'Forks, pins, skewers, discovered attacks and back-rank mates, drilled until you see them instantly.',
    level: 'Beginner', rating: '600–1400', icon: '⚔️', tone: 'orange',
    chapters: [
      { title: 'Double attacks', steps: [lesson('forks'), puzzles('fork', 15)] },
      { title: 'Lines: pins and skewers', steps: [lesson('pins-skewers'), puzzles('pin', 10), puzzles('skewer', 10)] },
      { title: 'Hidden attacks', steps: [lesson('discovered'), puzzles('discoveredAttack', 10), puzzles('doubleCheck', 5)] },
      { title: 'Mating patterns', steps: [lesson('mating-patterns'), puzzles('backRankMate', 10), puzzles('mateIn2', 10)] },
      { title: 'Tricks of the trade', steps: [puzzles('capturingDefender', 10), puzzles('trappedPiece', 10), bot('viktor')] },
    ],
  },
  {
    id: 'repertoire', title: 'A Club Player’s Repertoire', tagline: 'One opening for each situation, the traps in them, and a quiz to make it stick.',
    level: 'Intermediate', rating: '800–1600', icon: '📖', tone: 'gold',
    chapters: [
      { title: 'Principles', steps: [lesson('opening-rules'), lesson('repertoire-intro')] },
      { title: 'As White', steps: [opening('italian'), opening('alapin'), opening('french-advance'), opening('caro-advance')] },
      { title: 'As Black', steps: [opening('e5-vs-italian'), opening('e5-vs-ruy'), opening('qgd')] },
      { title: 'Traps', steps: [opening('trap-fried-liver'), opening('trap-legal'), opening('trap-blackburne')] },
      { title: 'Test it', steps: [bot('nora'), bot('gia')] },
    ],
  },
  {
    id: 'endgames', title: 'Endgame Essentials', tagline: 'The endgames every club player must know, explained and then played out against best defence.',
    level: 'Intermediate', rating: '800–1800', icon: '🏁', tone: 'green',
    chapters: [
      { title: 'Basic mates', steps: [lesson('basic-mates'), drill('two-rooks'), drill('two-bishops')] },
      { title: 'King and pawn', steps: [lesson('kp-endgames'), drill('kp-opposition'), drill('kp-key'), drill('square'), drill('kp-hold')] },
      { title: 'Pawn endgame technique', steps: [lesson('pawn-endgame-technique'), puzzles('pawnEndgame', 10)] },
      { title: 'Rook endgames', steps: [lesson('rook-endgames'), drill('lucena'), drill('philidor'), puzzles('rookEndgame', 10)] },
      { title: 'Minor pieces and queens', steps: [lesson('minor-endgames'), lesson('queen-endgames'), drill('queen-vs-pawn')] },
      { title: 'Final exam', steps: [bot('hugo')] },
    ],
  },
  {
    id: 'strategy', title: 'Strategy and Planning', tagline: 'Pawn structure, good and bad pieces, open files and how to make a plan when there are no tactics.',
    level: 'Intermediate', rating: '1000–1800', icon: '🧭', tone: 'purple',
    chapters: [
      { title: 'Pawns', steps: [lesson('pawn-structure'), lesson('pawn-weaknesses'), lesson('passed-pawns')] },
      { title: 'Pieces', steps: [lesson('open-files'), lesson('bishops'), lesson('pieces-activity')] },
      { title: 'The middlegame', steps: [lesson('pawn-breaks'), lesson('center-king'), lesson('trades')] },
      { title: 'Making a plan', steps: [lesson('planning'), bot('nora'), bot('hugo')] },
    ],
  },
  {
    id: 'attack', title: 'Attack the King', tagline: 'Sacrifices, deflections and mating nets: how strong players finish games.',
    level: 'Advanced', rating: '1200–2000', icon: '🔥', tone: 'pink',
    chapters: [
      { title: 'Calculation', steps: [lesson('calculation'), puzzles('mateIn3', 10)] },
      { title: 'The attack', steps: [lesson('king-attack'), puzzles('sacrifice', 10), puzzles('attraction', 10)] },
      { title: 'Deflect and destroy', steps: [puzzles('deflection', 10), puzzles('smotheredMate', 5), puzzles('arabianMate', 5)] },
      { title: 'Take on an attacker', steps: [bot('gia'), bot('mira')] },
    ],
  },
  {
    id: 'road-1500', title: 'Road to 1500 and Beyond', tagline: 'Convert won games, train like a club player and earn your first rating.',
    level: 'Advanced', rating: '1300–2000', icon: '🎯', tone: 'cyan',
    chapters: [
      { title: 'Winning won games', steps: [lesson('converting'), puzzles('zugzwang', 10), puzzles('promotion', 10)] },
      { title: 'Training', steps: [lesson('training-plan'), lesson('review-games'), safety(100)] },
      { title: 'Rated chess', steps: [lesson('fide-rating'), bot('mira'), bot('titan')] },
    ],
  },
];

export const findCourse = (id: string) => COURSES.find((c) => c.id === id);
export const stepKey = (s: Step) => `${s.kind}:${'id' in s ? s.id : 'theme' in s ? `${s.theme}:${s.count}` : 'bot' in s ? s.bot : s.count}`;

export function countThemeSolve(theme: string): void {
  const all = load<Record<string, number>>(KEYS.themeSolved, {});
  save(KEYS.themeSolved, { ...all, [theme]: (all[theme] ?? 0) + 1 });
}

/** Everything the steps need to know whether they're done, read once. */
export function progressSnapshot() {
  return {
    lessons: new Set(load<string[]>(KEYS.lessonsDone, [])),
    themes: load<Record<string, number>>(KEYS.themeSolved, {}),
    drills: load<Record<string, number>>(KEYS.drillsDone, {}),
    openings: load<Record<string, number>>(KEYS.openingsDone, {}),
    quiz: load<Record<string, Record<string, unknown>>>(KEYS.openingQuiz, {}),
    safety: load<{ total?: number }>(KEYS.safety, {}).total ?? 0,
    bots: load<Record<string, { w: number }>>(KEYS.botRecord, {}),
    manual: load<Record<string, number>>(KEYS.coursesDone, {}),
  };
}
export type Snapshot = ReturnType<typeof progressSnapshot>;

/** How far along a step is, from 0 to 1. */
export function stepProgress(s: Step, p: Snapshot): number {
  if (p.manual[stepKey(s)]) return 1;
  switch (s.kind) {
    case 'lesson':
      return p.lessons.has(s.id) ? 1 : 0;
    case 'puzzles':
      return Math.min(1, (p.themes[s.theme] ?? 0) / s.count);
    case 'drill':
      return p.drills[s.id] ? 1 : 0;
    case 'opening': {
      const lines = findOpening(s.id)?.lines ?? [];
      return lines.some((l) => p.openings[l.id] || p.quiz[l.id]) ? 1 : 0;
    }
    case 'safety':
      return Math.min(1, p.safety / s.count);
    case 'bot':
      return p.bots[s.bot]?.w ? 1 : 0;
  }
}

export interface StepView {
  title: string;
  sub: string;
  href: string;
  icon: string;
}

export function stepView(s: Step, p: Snapshot): StepView {
  switch (s.kind) {
    case 'lesson': {
      const l = findLesson(s.id)?.lesson;
      return { title: l?.title ?? s.id, sub: `Lesson · ${l?.minutes ?? 5} min`, href: `#/learn/${s.id}`, icon: '📘' };
    }
    case 'puzzles': {
      const label = THEMES.find((t) => t.key === s.theme)?.label ?? s.theme;
      return { title: `${label} puzzles`, sub: `Solve ${s.count} · ${Math.min(s.count, p.themes[s.theme] ?? 0)}/${s.count} done`, href: `#/train/theme/${s.theme}`, icon: '🧩' };
    }
    case 'drill':
      return { title: findDrill(s.id)?.title ?? s.id, sub: 'Endgame drill against best defence', href: `#/practice/drill/${s.id}`, icon: '♟️' };
    case 'opening': {
      const o = findOpening(s.id);
      return { title: o?.name ?? s.id, sub: `Opening · study it, then drill it`, href: `#/openings/${s.id}`, icon: '📖' };
    }
    case 'safety':
      return { title: `“Is it safe?” × ${s.count}`, sub: `The blunder-check drill · ${Math.min(s.count, p.safety)}/${s.count}`, href: '#/train/safe', icon: '🛡️' };
    case 'bot': {
      const b = findBot(s.bot);
      return { title: `Beat ${b?.name ?? s.bot}${b ? ` (${b.rating})` : ''}`, sub: b ? `${b.note}` : 'Bot game', href: `#/practice?bot=${s.bot}`, icon: b?.avatar ?? '🤖' };
    }
  }
}

export function courseProgress(c: Course, p: Snapshot): { done: number; total: number; pct: number; next: Step | null } {
  const steps = c.chapters.flatMap((ch) => ch.steps);
  const prog = steps.map((s) => stepProgress(s, p));
  const done = prog.filter((x) => x >= 1).length;
  return { done, total: steps.length, pct: Math.round((prog.reduce((a, b) => a + b, 0) / steps.length) * 100), next: steps.find((_, i) => prog[i] < 1) ?? null };
}

export function markStep(s: Step, done: boolean): void {
  const all = load<Record<string, number>>(KEYS.coursesDone, {});
  const k = stepKey(s);
  if (done) all[k] = Date.now();
  else delete all[k];
  save(KEYS.coursesDone, all);
}
