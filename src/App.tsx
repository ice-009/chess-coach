import { Suspense, lazy, useEffect, useRef } from 'react';
import { useRoute } from './lib/router';
import { Nav } from './components/Nav';
import { startAccount } from './lib/account';

startAccount(); // checks the session and keeps progress in sync with your account

// each page is its own chunk, so the first load stays small and fast
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const LearnPage = lazy(() => import('./pages/LearnPage').then((m) => ({ default: m.LearnPage })));
const OpeningsPage = lazy(() => import('./pages/OpeningsPage').then((m) => ({ default: m.OpeningsPage })));
const MastersPage = lazy(() => import('./pages/MastersPage').then((m) => ({ default: m.MastersPage })));
const GamesPage = lazy(() => import('./pages/GamesPage').then((m) => ({ default: m.GamesPage })));
const ExplorePage = lazy(() => import('./pages/ExplorePage').then((m) => ({ default: m.ExplorePage })));
const DatabasePage = lazy(() => import('./pages/DatabasePage').then((m) => ({ default: m.DatabasePage })));
const InsightsPage = lazy(() => import('./pages/InsightsPage').then((m) => ({ default: m.InsightsPage })));
const PracticePage = lazy(() => import('./pages/PracticePage').then((m) => ({ default: m.PracticePage })));
const TrainPage = lazy(() => import('./pages/TrainPage').then((m) => ({ default: m.TrainPage })));
const CoursesPage = lazy(() => import('./pages/CoursesPage').then((m) => ({ default: m.CoursesPage })));
const AccountPage = lazy(() => import('./pages/AccountPage').then((m) => ({ default: m.AccountPage })));
const OfflinePage = lazy(() => import('./pages/OfflinePage').then((m) => ({ default: m.OfflinePage })));

export default function App() {
  const { parts, query } = useRoute();
  const [section = '', a, b] = parts;
  // a new page fades in by CSS when it mounts; moving within a section (a lesson, a course) slides the content in too
  const mainRef = useRef<HTMLElement>(null);
  const path = parts.join('/');
  const prev = useRef({ section, path });
  useEffect(() => {
    const was = prev.current;
    prev.current = { section, path };
    if (was.section !== section || was.path === path || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    mainRef.current?.firstElementChild?.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
  }, [section, path]);

  let page;
  switch (section) {
    case 'learn':
      page = <LearnPage lessonId={a} />;
      break;
    case 'openings':
      page = (
        <OpeningsPage
          key={`${query.get('view') ?? ''}${query.get('scope') ?? ''}`}
          openingId={a}
          lineId={b}
          mode={query.get('mode') ?? 'study'}
          view={query.get('view') ?? undefined}
          scope={query.get('scope') ?? undefined}
          color={query.get('color') ?? undefined}
        />
      );
      break;
    case 'masters':
      page = <MastersPage classicId={a === 'classic' ? b : undefined} />;
      break;
    case 'games':
      page = <GamesPage key={a ?? ''} username={a} gameUrl={query.get('game') ?? undefined} />;
      break;
    case 'explore':
      page = <ExplorePage key={query.get('fen') ?? ''} initialFen={query.get('fen') ?? undefined} />;
      break;
    case 'database':
      page = <DatabasePage key={`${a ?? ''}/${b ?? ''}`} sub={a} arg={b} query={query} />;
      break;
    case 'practice':
      page = <PracticePage key={`${a ?? ''}/${b ?? ''}/${query.get('bot') ?? ''}`} sub={a} arg={b} fen={query.get('fen') ?? undefined} color={query.get('color') ?? undefined} bot={query.get('bot') ?? undefined} />;
      break;
    case 'courses':
      page = <CoursesPage key={a ?? ''} courseId={a} />;
      break;
    case 'insights':
      page = <InsightsPage />;
      break;
    case 'train':
      page = <TrainPage key={a ?? ''} tab={a} arg={b} />;
      break;
    case 'account':
      page = <AccountPage />;
      break;
    case 'offline':
      page = <OfflinePage />;
      break;
    default:
      page = <HomePage />;
  }

  return (
    <div className="shell">
      <Nav active={section} />
      <main className="app" data-section={section} ref={mainRef}>
        <Suspense fallback={<div className="page-loading"><span className="spinner" /></div>}>{page}</Suspense>
      </main>
    </div>
  );
}
