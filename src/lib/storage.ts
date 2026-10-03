// Tiny typed wrappers around localStorage; every access is guarded because storage can be unavailable.

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: progress just won't persist
  }
}

export const KEYS = {
  me: 'cca-me',
  lessonsDone: 'cca-lessons-done',
  openingsDone: 'cca-openings-done', // lineId → times completed cleanly
  puzzles: 'cca-puzzles',
  puzzlesSolved: 'cca-puzzles-solved',
  accuracy: 'cca-accuracy',
  puzzleRating: 'cca-puzzle-rating',
  puzzleSeen: 'cca-puzzle-seen',
  puzzleReview: 'cca-puzzle-review',
  rushBest: 'cca-rush-best',
  activity: 'cca-activity',
  visionBest: 'cca-vision-best',
  drillsDone: 'cca-drills-done',
  openingQuiz: 'cca-opening-quiz', // lineId → { w, b }: last quiz result as each colour
};

export function getMe(): string {
  return load<string>(KEYS.me, '');
}
