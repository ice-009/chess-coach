import { useEffect, useState } from 'react';
import { DeviceDatabase } from '../components/DeviceDatabase';
import { STATIC_HOST } from '../lib/host';

const PUZZLE_CACHE = 'cc-puzzles'; // the same cache the service worker serves puzzles from (server/offlineSw.ts)
const canCache = typeof caches !== 'undefined' && 'serviceWorker' in navigator;
const mb = (bytes: number) => `${Math.round(bytes / 1e6)} MB`;

function AppStatus() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!canCache) return;
    let live = true;
    navigator.serviceWorker.ready.then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);
  return (
    <section className="offline-item">
      <span className={`offline-mark ${ready ? 'on' : ''}`}>{ready ? '✓' : '…'}</span>
      <div>
        <b>The app</b>
        <div className="muted small">
          {!canCache
            ? 'This browser can’t save the app for offline use. Open ChessCoach at its https address in Safari.'
            : ready
              ? 'Saved on this device: lessons, openings, drills, practice, game review and Stockfish all work offline.'
              : 'Saving the app for offline use…'}
        </div>
      </div>
    </section>
  );
}

function PuzzleStatus() {
  const [info, setInfo] = useState<{ saved: number; files: string[]; bytes: number } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');

  const refresh = async () => {
    const man = (await fetch('/puzzles/manifest.json').then((r) => r.json())) as { files?: string[]; bytes?: number };
    const files = man.files ?? [];
    const have = new Set((await (await caches.open(PUZZLE_CACHE)).keys()).map((r) => new URL(r.url).pathname));
    setInfo({ saved: files.filter((f) => have.has(`/puzzles/${f}`)).length, files, bytes: man.bytes ?? 0 });
  };
  useEffect(() => {
    if (canCache) refresh().catch(() => undefined);
  }, []);

  async function saveAll() {
    if (!info) return;
    setError('');
    setBusy(0);
    try {
      const cache = await caches.open(PUZZLE_CACHE);
      const todo = [...info.files];
      let done = 0;
      // four downloads at a time
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          for (let f = todo.shift(); f; f = todo.shift()) {
            if (!(await cache.match(`/puzzles/${f}`))) await cache.add(`/puzzles/${f}`);
            setBusy(++done / info.files.length);
          }
        }),
      );
      await cache.add('/puzzles/manifest.json');
    } catch {
      setError('The download stopped. Check the connection and tap the button again; finished parts are kept.');
    } finally {
      setBusy(null);
      refresh().catch(() => undefined);
    }
  }

  if (!STATIC_HOST || !canCache) return null;
  const all = info && info.files.length > 0 && info.saved === info.files.length;
  return (
    <section className="offline-item">
      <span className={`offline-mark ${all ? 'on' : ''}`}>{all ? '✓' : '…'}</span>
      <div style={{ flex: 1 }}>
        <b>Puzzles</b>
        <div className="muted small">
          {all
            ? 'All 280,000 puzzles are saved: rated puzzles, themes, Rush and your review queue work offline.'
            : `Puzzles you have opened are kept. Save all of them (${info ? mb(info.bytes) : '…'}) to train anything on a flight.`}
        </div>
        {busy !== null && <div className="progress big"><div style={{ width: `${busy * 100}%`, transform: 'none' }} /></div>}
        {error && <div className="error">{error}</div>}
      </div>
      {!all && info && busy === null && <button className="btn-secondary" onClick={saveAll}>Save all puzzles</button>}
    </section>
  );
}

function StorageStatus() {
  const [est, setEst] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null);
  const refresh = async () => {
    const e = await navigator.storage?.estimate?.();
    const persisted = (await navigator.storage?.persisted?.()) ?? false;
    if (e) setEst({ usage: e.usage ?? 0, quota: e.quota ?? 0, persisted });
  };
  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);
  if (!est) return null;
  return (
    <section className="offline-item">
      <span className={`offline-mark ${est.persisted ? 'on' : ''}`}>{est.persisted ? '✓' : 'i'}</span>
      <div style={{ flex: 1 }}>
        <b>Storage</b>
        <div className="muted small">
          {mb(est.usage)} used{est.quota ? ` of ${mb(est.quota)} available to this site` : ''}.{' '}
          {est.persisted
            ? 'Kept permanently: the browser won’t clear it to make room.'
            : 'Open ChessCoach from its Home Screen icon and use it regularly; Safari may clear data of sites you haven’t opened for weeks.'}
        </div>
      </div>
      {!est.persisted && navigator.storage?.persist && (
        <button className="btn-secondary" onClick={() => navigator.storage.persist().then(refresh)}>Keep my data</button>
      )}
    </section>
  );
}

// iPhone/iPad Home Screen apps keep their own storage, separate from Safari's
const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const touchDevice = matchMedia('(pointer: coarse)').matches;

export function OfflinePage() {
  return (
    <div className="offline-page">
      <div className="page-head">
        <h1>Offline and on a flight</h1>
        <p className="muted">Everything on this page stays on this device and works without internet.</p>
      </div>
      {STATIC_HOST && touchDevice && !standalone && (
        <div className="note">
          Using ChessCoach from the Home Screen? Then do these steps <b>in the Home Screen app</b>, not here in Safari: it keeps its own
          storage. To add it: Share → Add to Home Screen.
        </div>
      )}
      <div className="offline-list">
        <AppStatus />
        <PuzzleStatus />
        <StorageStatus />
      </div>
      <DeviceDatabase />
      <section className="chapter">
        <h2>Before you fly</h2>
        <ol className="steps">
          <li>Add ChessCoach to your Home Screen (Share → Add to Home Screen) and open it from there.</li>
          <li>Open it once with internet after each update, so the newest version is saved.</li>
          <li>Tap <b>Save all puzzles</b> and load the master database above.</li>
          <li>Open your chess.com games once (Review → your username): game lists and games you have opened are kept, and finished reviews are saved.</li>
          <li>Turn on Airplane Mode and try it: if something is missing, you still have time to fix it.</li>
        </ol>
        <p className="muted small">Offline you can’t download new chess.com games or ask the AI coach; everything else works.</p>
      </section>
    </div>
  );
}
