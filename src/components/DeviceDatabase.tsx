import { useEffect, useRef, useState } from 'react';
import { importLocalDb, localStatus, removeLocalDb } from '../lib/localDb';
import type { LocalStatus } from '../lib/localDb';
import { platform } from '../lib/install';

const gb = (bytes: number) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : `${Math.round(bytes / 1e6)} MB`);

/**
 * Puts the master database on this device (hosted site): the person picks their own masters.db, e.g. from the
 * Files app after an AirDrop from their Mac; it is copied into the browser's private storage and never uploaded.
 */
export function DeviceDatabase({ onChange, compact }: { onChange?: (st: LocalStatus) => void; compact?: boolean }) {
  const [status, setStatus] = useState<LocalStatus | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStatus().then(setStatus, () => setStatus({ ready: false, meta: null, bytes: 0 }));
  }, []);

  async function pick(file: File) {
    setError('');
    setProgress(0);
    try {
      const est = await navigator.storage?.estimate?.();
      if (est?.quota && est.usage !== undefined && est.quota - est.usage < file.size * 1.05)
        throw new Error(`Not enough storage: the file needs ${gb(file.size)}, but only ${gb(est.quota - est.usage)} is free for this site.`);
      const st = await importLocalDb(file, setProgress);
      setStatus(st);
      onChange?.(st);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
      if (input.current) input.current.value = '';
    }
  }

  async function remove() {
    if (!confirm('Remove the master database from this device? You can load it again later.')) return;
    await removeLocalDb();
    const st = { ready: false, meta: null, bytes: 0 };
    setStatus(st);
    onChange?.(st);
  }

  if (!status) return <div className="page-loading"><span className="spinner" /></div>;
  const m = status.meta;
  const os = platform();
  const fileInput = (
    <input ref={input} type="file" hidden onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
  );

  if (status.ready && progress === null)
    return (
      <div className="device-db ready">
        <div className="row-between">
          <div>
            <b>✓ The master database is on this device</b>
            <div className="muted small">
              {m ? `${Number(m.otb_games ?? m.games).toLocaleString()} over-the-board games${Number(m.online_games) > 0 ? ` + ${Number(m.online_games).toLocaleString()} online` : ''} · ${Number(m.players).toLocaleString()} players · ` : ''}
              {gb(status.bytes)} · works offline
            </div>
          </div>
          <div className="row">
            {!compact && <a className="btn-secondary" href="#/database">Open</a>}
            <button className="btn-ghost" onClick={() => input.current?.click()}>Replace</button>
            <button className="btn-ghost" onClick={remove}>Remove</button>
          </div>
        </div>
        {fileInput}
        {error && <div className="error">{error}</div>}
      </div>
    );

  return (
    <div className="device-db">
      <h2>Put the master database on this device</h2>
      <p>
        The opening explorer, game search and player pages then work right here, even with no internet. The database stays on this device:
        it is never uploaded.
      </p>
      <ol className="steps">
        <li>
          On your Mac, in the ChessCoach folder, run <code>npm run db:export</code>. It saves <b>ChessCoach-masters.db</b> (about 0.75 GB) on your Desktop.
          For a phone, <code>npm run db:export -- --otb</code> makes a 0.4 GB copy with the over-the-board games only.
        </li>
        <li>
          {os === 'ios'
            ? <>AirDrop it to this device and choose <b>Save to Files</b> (or copy it with iCloud Drive or a USB cable).</>
            : os === 'android'
              ? <>Send it to this phone with <b>Quick Share</b>, Google Drive or a USB cable, and save it (e.g. in Downloads).</>
              : <>Copy it to this computer.</>}
        </li>
        <li>{os === 'other' ? 'Click' : 'Tap'} the button below and pick the file. Loading takes a minute; keep this page open.</li>
      </ol>
      {progress !== null ? (
        <div className="build-progress">
          <div className="row-between">
            <b>Copying the database onto this device…</b>
            <span className="muted small">{Math.round(progress * 100)}%</span>
          </div>
          <div className="progress big"><div style={{ width: `${progress * 100}%`, transform: 'none' }} /></div>
        </div>
      ) : (
        <button className="btn-green" onClick={() => input.current?.click()}>Choose the database file</button>
      )}
      {fileInput}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
