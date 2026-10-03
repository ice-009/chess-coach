import type { Classification } from './analysis';

export const CLASS_META: Record<Classification, { label: string; color: string; symbol: string; verb: string }> = {
  brilliant: { label: 'Brilliant', color: '#26c2a3', symbol: '!!', verb: 'brilliant' },
  great: { label: 'Great', color: '#5c8bb0', symbol: '!', verb: 'a great move' },
  book: { label: 'Book', color: '#a88865', symbol: '', verb: 'a book move' },
  best: { label: 'Best', color: '#81b64c', symbol: '★', verb: 'the best move' },
  excellent: { label: 'Excellent', color: '#96bc4b', symbol: '', verb: 'excellent' },
  good: { label: 'Good', color: '#95b776', symbol: '✓', verb: 'good' },
  inaccuracy: { label: 'Inaccuracy', color: '#f7c631', symbol: '?!', verb: 'an inaccuracy' },
  mistake: { label: 'Mistake', color: '#ffa459', symbol: '?', verb: 'a mistake' },
  miss: { label: 'Miss', color: '#ff7769', symbol: '✕', verb: 'a miss' },
  blunder: { label: 'Blunder', color: '#fa412d', symbol: '??', verb: 'a blunder' },
};

export const CLASS_ORDER: Classification[] = ['brilliant', 'great', 'book', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'miss', 'blunder'];
