import { useState } from 'react';
import { navigate } from '../lib/router';
import { NavIcons } from './icons';

const TABS = [
  { id: '', icon: 'home', label: 'Home', primary: true },
  { id: 'learn', icon: 'learn', label: 'Learn', primary: true },
  { id: 'train', icon: 'train', label: 'Puzzles', primary: true },
  { id: 'practice', icon: 'practice', label: 'Practice' },
  { id: 'games', icon: 'games', label: 'Review', primary: true },
  { id: 'insights', icon: 'insights', label: 'Insights' },
  { id: 'openings', icon: 'openings', label: 'Openings' },
  { id: 'masters', icon: 'masters', label: 'Masters' },
  { id: 'database', icon: 'database', label: 'Database' },
  { id: 'explore', icon: 'explore', label: 'Analysis' },
];

/** Left sidebar on desktop; on phones a bottom bar with the main tabs plus a "More" sheet. */
export function Nav({ active }: { active: string }) {
  const [more, setMore] = useState(false);
  const link = (t: (typeof TABS)[number]) => (
    <a
      key={t.id}
      href={`#/${t.id}`}
      className={`side-link ${active === t.id ? 'on' : ''} ${t.primary ? 'nav-main' : 'nav-extra'}`}
      onClick={(e) => {
        e.preventDefault();
        setMore(false);
        navigate(t.id);
      }}
    >
      <span className="side-icon">{NavIcons[t.icon]}</span>
      <span className="side-label">{t.label}</span>
    </a>
  );
  const activeIsSecondary = TABS.some((t) => !t.primary && t.id === active);
  return (
    <>
      <aside className="sidebar">
        <a className="logo" href="#/" aria-label="Home">
          <span className="logo-mark">♞</span>
          <span className="logo-text">Chess<b>Coach</b></span>
        </a>
        <nav>
          {TABS.map(link)}
          <button className={`side-link more-btn ${more || activeIsSecondary ? 'on' : ''}`} onClick={() => setMore((m) => !m)} aria-expanded={more}>
            <span className="side-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
            </span>
            <span className="side-label">More</span>
          </button>
        </nav>
      </aside>
      {more && (
        <div className="more-sheet" onClick={() => setMore(false)}>
          <div className="more-panel" onClick={(e) => e.stopPropagation()}>
            {TABS.filter((t) => !t.primary).map(link)}
          </div>
        </div>
      )}
    </>
  );
}
