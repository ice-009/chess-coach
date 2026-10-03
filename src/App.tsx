import { Suspense, lazy } from 'react';
import { useRoute } from './lib/router';
import { Nav } from './components/Nav';

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
const OfflinePage = lazy(() => import('./pages/OfflinePage').then((m) => ({ default: m.OfflinePage })));

export default function App() {
  const { parts, query } = useRoute();
  const [section = '', a, b] = parts;

  let page;
  switch (section) {
    case 'learn':
      page = <LearnPage lessonId={a} />;
      break;
    case 'openings':
      page = <OpeningsPage openingId={a} lineId={b} mode={query.get('mode') ?? 'study'} />;
      break;
    case 'masters':
      page = <MastersPage classicId={a === 'classic' ? b : undefined} />;
      break;
    case 'games':
      page = <GamesPage key={a ?? ''} username={a} />;
      break;
    case 'explore':
      page = <ExplorePage key={query.get('fen') ?? ''} initialFen={query.get('fen') ?? undefined} />;
      break;
    case 'database':
      page = <DatabasePage key={`${a ?? ''}/${b ?? ''}`} sub={a} arg={b} query={query} />;
      break;
    case 'practice':
      page = <PracticePage key={`${a ?? ''}/${b ?? ''}`} sub={a} arg={b} fen={query.get('fen') ?? undefined} color={query.get('color') ?? undefined} />;
      break;
    case 'insights':
      page = <InsightsPage />;
      break;
    case 'train':
      page = <TrainPage key={a ?? ''} tab={a} arg={b} />;
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
      <main className="app">
        <Suspense fallback={<div className="page-loading"><span className="spinner" /></div>}>{page}</Suspense>
      </main>
    </div>
  );
}
