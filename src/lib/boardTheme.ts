import { useSyncExternalStore } from 'react';
import { KEYS, load, save } from './storage';

// Board colour themes. The colours themselves live in src/index.css ("Board skin"), keyed on data-board-theme,
// so a theme is just an attribute; this module only remembers the choice and tells every board when it changes.

export const BOARD_THEMES = [
  { id: 'midnight', name: 'Midnight', light: '#cdd6ec', dark: '#5b6c9e' },
  { id: 'classic', name: 'Classic green', light: '#ebecd0', dark: '#739552' },
  { id: 'walnut', name: 'Walnut', light: '#e6c493', dark: '#9a5f37' },
  { id: 'ice', name: 'Ice', light: '#eaf4fa', dark: '#86adc9' },
  { id: 'neon', name: 'Neon', light: '#33407a', dark: '#1a2048' },
] as const;
export type BoardThemeId = (typeof BOARD_THEMES)[number]['id'];

const valid = (id: unknown): id is BoardThemeId => BOARD_THEMES.some((t) => t.id === id);
let current: BoardThemeId = (() => {
  const saved = load<string>(KEYS.boardTheme, 'midnight');
  return valid(saved) ? saved : 'midnight';
})();

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function setBoardTheme(id: BoardThemeId) {
  if (id === current) return;
  current = id;
  save(KEYS.boardTheme, id);
  for (const fn of listeners) fn();
}

// another tab picked a theme: follow it
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEYS.boardTheme) return;
    const id = load<string>(KEYS.boardTheme, 'midnight');
    if (valid(id) && id !== current) {
      current = id;
      for (const fn of listeners) fn();
    }
  });
}

/** The board theme every board shows; re-renders when it changes anywhere. */
export function useBoardTheme(): BoardThemeId {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
