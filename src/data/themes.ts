// The ideas the review explains moves with, and the lesson that teaches each one (checked by scripts/validate-data.ts).

export type Theme =
  | 'mate'
  | 'material'
  | 'fork'
  | 'pin'
  | 'defend'
  | 'threat'
  | 'castle'
  | 'develop'
  | 'center'
  | 'open-file'
  | 'seventh'
  | 'outpost'
  | 'bishop'
  | 'passed-pawn'
  | 'pawn-break'
  | 'king-activity'
  | 'trade'
  | 'improve';

/** The lesson that teaches each idea (ids from src/data/lessons.ts). */
export const THEME_LESSON: Record<Theme, string> = {
  mate: 'mating-patterns',
  material: 'blunder-check',
  fork: 'forks',
  pin: 'pins-skewers',
  defend: 'blunder-check',
  threat: 'blunder-check',
  castle: 'center-king',
  develop: 'opening-rules',
  center: 'opening-rules',
  'open-file': 'open-files',
  seventh: 'open-files',
  outpost: 'pieces-activity',
  bishop: 'bishops',
  'passed-pawn': 'passed-pawns',
  'pawn-break': 'pawn-breaks',
  'king-activity': 'kp-endgames',
  trade: 'trades',
  improve: 'pieces-activity',
};

/** Short name of the lesson behind each idea, for "Learn" links. */
export const THEME_LABEL: Record<Theme, string> = {
  mate: 'Mating patterns',
  material: 'The blunder check',
  fork: 'Forks',
  pin: 'Pins',
  defend: 'The blunder check',
  threat: 'The blunder check',
  castle: 'Centre and king safety',
  develop: 'Opening rules',
  center: 'Opening rules',
  'open-file': 'Rooks and open files',
  seventh: 'Rooks and open files',
  outpost: 'Knights and outposts',
  bishop: 'Good and bad bishops',
  'passed-pawn': 'Passed pawns',
  'pawn-break': 'Pawn breaks',
  'king-activity': 'King and pawn endgames',
  trade: 'When to trade',
  improve: 'Improving your pieces',
};
