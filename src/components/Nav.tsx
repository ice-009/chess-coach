import { useLayoutEffect, useRef, useState } from 'react';
import { navigate } from '../lib/router';
import { STATIC_HOST } from '../lib/host';
import { useAccount } from '../lib/account';
import { playSound, setSoundOn, useSoundOn } from '../lib/sound';
import { NavIcons } from './icons';

const TABS = [
  { id: '', icon: 'home', label: 'Home', tone: 'green', primary: true },
  { id: 'learn', icon: 'learn', label: 'Learn', tone: 'blue', primary: true },
  { id: 'train', icon: 'train', label: 'Puzzles', tone: 'orange', primary: true },
  { id: 'practice', icon: 'practice', label: 'Play', tone: 'purple', primary: true },
  { id: 'games', icon: 'games', label: 'Review', tone: 'green', primary: true },
  { id: 'insights', icon: 'insights', label: 'Insights', tone: 'cyan' },
  { id: 'courses', icon: 'courses', label: 'Courses', tone: 'pink' },
  { id: 'openings', icon: 'openings', label: 'Openings', tone: 'gold' },
  { id: 'masters', icon: 'masters', label: 'Masters', tone: 'gold' },
  { id: 'database', icon: 'database', label: 'Database', tone: 'blue' },
  { id: 'explore', icon: 'explore', label: 'Analysis', tone: 'blue' },
  // the hosted site can save itself and the master database on the device
  ...(STATIC_HOST ? [{ id: 'offline', icon: 'offline', label: 'Offline', tone: 'grey' }] : []),
];

/** Left sidebar on desktop; on phones a bottom bar with the main tabs plus a "More" sheet. */
export function Nav({ active }: { active: string }) {
  const [more, setMore] = useState(false);
  // the active-tab indicator glides to the highlighted link (left edge on the rail, top edge on the phone bar)
  const navRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const place = () => {
      const on = [...nav.querySelectorAll<HTMLElement>(':scope > .side-link.on')].find((el) => el.offsetWidth > 0);
      nav.classList.toggle('has-ind', !!on);
      if (!on) return;
      nav.style.setProperty('--ind-x', `${on.offsetLeft}px`);
      nav.style.setProperty('--ind-y', `${on.offsetTop}px`);
      nav.style.setProperty('--ind-w', `${on.offsetWidth}px`);
      nav.style.setProperty('--ind-h', `${on.offsetHeight}px`);
      nav.style.setProperty('--ind-rgb', getComputedStyle(on).getPropertyValue('--tone-rgb') || '88, 195, 92');
    };
    place();
    requestAnimationFrame(() => nav.classList.add('ind-ready')); // glide from now on, not on the first paint
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [active, more]);
  const link = (t: (typeof TABS)[number]) => (
    <a
      key={t.id}
      href={`#/${t.id}`}
      className={`side-link ${active === t.id ? 'on' : ''} ${t.primary ? 'nav-main' : 'nav-extra'}`}
      data-tone={t.tone}
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
  const account = useAccount();
  const sound = useSoundOn();
  const soundToggle = (where: string) => (
    <button
      className={`side-link sound-toggle ${where}`}
      aria-pressed={sound}
      onClick={() => {
        setSoundOn(!sound);
        if (!sound) playSound('move'); // a sample, so you hear it's on
      }}
    >
      <span className="side-icon">{sound ? NavIcons.soundOn : NavIcons.soundOff}</span>
      <span className="side-label">{sound ? 'Sound on' : 'Sound off'}</span>
    </button>
  );
  const activeIsSecondary = active === 'account' || TABS.some((t) => !t.primary && t.id === active);
  // your account: at the foot of the sidebar, and in the "More" sheet on phones
  const accountLink = (where: string) => (
    <a
      href="#/account"
      className={`side-link side-account ${where} ${active === 'account' ? 'on' : ''}`}
      onClick={(e) => {
        e.preventDefault();
        setMore(false);
        navigate('account');
      }}
    >
      <span className="side-icon"><span className={`nav-avatar ${account.user ? 'in' : ''}`}>{account.user ? account.user.username[0].toUpperCase() : NavIcons.account}</span></span>
      <span className="side-label">{account.user ? account.user.username : 'Sign in'}</span>
    </a>
  );
  return (
    <>
      <aside className="sidebar">
        <a className="logo" href="#/" aria-label="Home">
          <span className="logo-mark">♞</span>
          <span className="logo-text">Chess<b>Coach</b></span>
        </a>
        <nav ref={navRef}>
          <span className="nav-ind" aria-hidden="true" />
          {TABS.map(link)}
          <button className={`side-link more-btn ${more || activeIsSecondary ? 'on' : ''}`} onClick={() => setMore((m) => !m)} aria-expanded={more}>
            <span className="side-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
            </span>
            <span className="side-label">More</span>
          </button>
        </nav>
        {soundToggle('in-rail')}
        {accountLink('in-rail')}
      </aside>
      {more && (
        <div className="more-sheet" onClick={() => setMore(false)}>
          <div className="more-panel" onClick={(e) => e.stopPropagation()}>
            {TABS.filter((t) => !t.primary).map(link)}
            {soundToggle('in-sheet')}
            {accountLink('in-sheet')}
          </div>
        </div>
      )}
    </>
  );
}
