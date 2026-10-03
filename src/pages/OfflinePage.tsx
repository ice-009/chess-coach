import { useEffect, useState } from 'react';
import { DeviceDatabase } from '../components/DeviceDatabase';
import { STATIC_HOST } from '../lib/host';
import { canPromptInstall, isInstalled, onInstallChange, platform, promptInstall } from '../lib/install';

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
      <div>
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
      <div>
        <b>Storage</b>
        <div className="muted small">
          {mb(est.usage)} used{est.quota ? ` of ${mb(est.quota)} available to this site` : ''}.{' '}
          {est.persisted
            ? 'Kept permanently: the browser won’t clear it to make room.'
            : 'Open ChessCoach from its icon and use it regularly: browsers may clear data of sites you haven’t opened for weeks, unless you tap Keep my data.'}
        </div>
      </div>
      {!est.persisted && navigator.storage?.persist && (
        <button className="btn-secondary" onClick={() => navigator.storage.persist().then(refresh)}>Keep my data</button>
      )}
    </section>
  );
}

/** Install the app first: on iPhone/iPad the Home Screen app even has its own storage, separate from Safari's. */
function InstallCard() {
  const [canPrompt, setCanPrompt] = useState(canPromptInstall);
  useEffect(() => onInstallChange(() => setCanPrompt(canPromptInstall())), []);
  if (!STATIC_HOST) return null;
  const os = platform();
  if (isInstalled())
    return (
      <section className="offline-item">
        <span className="offline-mark on">✓</span>
        <div>
          <b>Installed</b>
          <div className="muted small">You’re using the ChessCoach app: everything you save here stays with it.</div>
        </div>
      </section>
    );
  return (
    <section className="offline-item install">
      <span className="offline-mark">1</span>
      <div>
        <b>Install ChessCoach first</b>
        <div className="muted small">
          {canPrompt
            ? 'It gets its own icon, opens full screen and works offline. No app store needed.'
            : os === 'ios'
              ? 'In Safari tap Share (the square with an arrow), then Add to Home Screen. Open ChessCoach from that icon and do the steps below there: the Home Screen app keeps its own storage, separate from Safari.'
              : os === 'android'
                ? 'In Chrome tap the ⋮ menu, then Install app (or Add to Home screen). Then open ChessCoach from its icon.'
                : 'In Chrome or Edge, use the install icon at the right of the address bar.'}
        </div>
      </div>
      {canPrompt && <button className="btn-green" onClick={() => promptInstall()}>Install</button>}
    </section>
  );
}

export function OfflinePage() {
  return (
    <div className="offline-page">
      <div className="page-head">
        <h1>Offline and on a flight</h1>
        <p className="muted">Everything on this page stays on this device and works without internet.</p>
      </div>
      <div className="offline-list">
        <InstallCard />
        <AppStatus />
        <PuzzleStatus />
        <StorageStatus />
      </div>
      <DeviceDatabase />
      <section className="chapter">
        <h2>Before you fly</h2>
        <ol className="steps">
          <li>Install ChessCoach (see the top of this page) and open it from its icon.</li>
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
