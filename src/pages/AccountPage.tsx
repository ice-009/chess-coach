import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ALL_LESSONS } from '../data/lessons';
import { DRILLS } from '../data/drills';
import { AccountError, changePassword, deleteAccount, lastUsername, signIn, signOut, signUp, syncNow, useAccount } from '../lib/account';
import type { AccountState } from '../lib/account';
import { SyncBadge } from '../components/SyncBadge';
import { getProfile } from '../lib/chesscom';
import type { Profile } from '../lib/chesscom';
import { getRating } from '../lib/puzzles';
import { loadResults } from '../lib/openingQuiz';
import { navigate } from '../lib/router';
import { KEYS, getMe, load, save } from '../lib/storage';

const message = (e: unknown) => (e instanceof AccountError || e instanceof Error ? e.message : 'Something went wrong. Try again.');

function PasswordInput({ value, onChange, autoComplete, label, id }: { value: string; onChange: (v: string) => void; autoComplete: string; label: string; id: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="acc-field" htmlFor={id}>
      <span>{label}</span>
      <div className="pw-wrap">
        <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} autoCapitalize="none" autoCorrect="off" spellCheck={false} required minLength={autoComplete === 'current-password' ? 1 : 8} />
        <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
      </div>
    </label>
  );
}

function SignInForm() {
  const [mode, setMode] = useState<'login' | 'signup'>(lastUsername() ? 'login' : 'signup');
  const [username, setUsername] = useState(lastUsername);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hasProgress = load<string[]>(KEYS.lessonsDone, []).length > 0 || getRating().games > 0 || !!getMe();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await (mode === 'login' ? signIn : signUp)(username.trim(), password);
      navigate('');
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="auth-card panel" onSubmit={submit}>
        <div className="auth-logo">♞</div>
        <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="muted">{mode === 'login' ? 'Sign in to pick up where you left off, on any device.' : 'Free, and no email needed. Just a username and a password.'}</p>
        <div className="seg-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setError(''); }}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => { setMode('signup'); setError(''); }}>Create account</button>
        </div>
        <label className="acc-field" htmlFor="acc-user">
          <span>Username</span>
          <input id="acc-user" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required pattern="[A-Za-z0-9_\-]{3,20}" title="3 to 20 letters, digits, - or _" />
        </label>
        <PasswordInput id="acc-pass" label="Password" value={password} onChange={setPassword} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        {mode === 'signup' && <div className="muted small">At least 8 characters. Safari can suggest a strong password and save it to your Keychain.</div>}
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn-green big" disabled={busy}>{busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        {mode === 'signup' && hasProgress && <div className="note small">The progress already on this device (lessons, puzzles, ratings) will be saved to your new account.</div>}
      </form>
      <div className="auth-why">
        <h3>Why an account?</h3>
        <ul>
          <li><span>📱</span><div><b>One coach on every device.</b> Lessons, puzzle rating, drills and opening quizzes follow you between your iPad, phone and laptop.</div></li>
          <li><span>♟️</span><div><b>Remembers you.</b> Your chess.com username is saved with your account, so your games and ratings are always one tap away.</div></li>
          <li><span>🔒</span><div><b>Private.</b> No email or personal details. Your password is stored only as a salted scrypt hash, and the sign-in cookie can’t be read by scripts.</div></li>
          <li><span>✈️</span><div><b>Still works offline.</b> Everything is saved on the device first and syncs when you’re back online.</div></li>
        </ul>
        <p className="muted small">There’s no email, so a forgotten password can’t be reset. Let Safari or your password manager remember it.</p>
      </div>
    </div>
  );
}

function ChessComLink() {
  const [me, setMe] = useState(getMe);
  const [input, setInput] = useState(me);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setProfile(null);
    if (!me) return;
    let cancelled = false;
    getProfile(me).then((p) => !cancelled && setProfile(p)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [me]);
  useEffect(() => {
    const refresh = () => {
      setMe(getMe());
      setInput(getMe());
    };
    window.addEventListener('cca-synced', refresh);
    return () => window.removeEventListener('cca-synced', refresh);
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const name = input.trim().toLowerCase();
    setError('');
    if (name) {
      try {
        await getProfile(name);
      } catch {
        setError('Couldn’t find that player on chess.com.');
        return;
      }
    }
    save(KEYS.me, name);
    setMe(name);
  }
  return (
    <section className="panel">
      <h3>chess.com account</h3>
      <p className="muted small acc-p">Your games, ratings and weakness report come from this player. It’s saved with your account.</p>
      {profile && (
        <div className="linked">
          {profile.avatar ? <img src={profile.avatar} alt="" /> : <span className="avatar-letter">{profile.username[0]?.toUpperCase()}</span>}
          <div>
            <b>{profile.username}</b>
            <div className="profile-ratings">{profile.ratings.map((r) => <span key={r.label} className="rating-pill"><span className="muted">{r.label}</span> <b>{r.rating}</b></span>)}</div>
          </div>
        </div>
      )}
      <form className="row" onSubmit={submit}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="chess.com username" aria-label="chess.com username" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <button className="btn-secondary" disabled={input.trim().toLowerCase() === me}>{me ? 'Change' : 'Link'}</button>
      </form>
      {error && <div className="error">{error}</div>}
    </section>
  );
}

function SavedSummary() {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    window.addEventListener('cca-synced', f);
    return () => window.removeEventListener('cca-synced', f);
  }, []);
  const quiz = Object.values(loadResults()).filter((r) => r.w?.passed || r.b?.passed).length;
  const rows = [
    ['Lessons finished', `${load<string[]>(KEYS.lessonsDone, []).length}/${ALL_LESSONS.length}`],
    ['Endgame drills won', `${Object.keys(load<Record<string, number>>(KEYS.drillsDone, {})).length}/${DRILLS.length}`],
    ['Puzzle rating', `${getRating().rating} (${getRating().games} played)`],
    ['Opening lines passed in quizzes', String(quiz)],
    ['Puzzles from your games', String(load<unknown[]>(KEYS.puzzles, []).length)],
  ];
  return (
    <section className="panel">
      <h3>Saved to your account</h3>
      <dl className="saved-list">
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </section>
  );
}

function PasswordForm() {
  const username = useAccount().user?.username ?? '';
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [state, setState] = useState<{ busy?: boolean; error?: string; done?: boolean }>({});
  async function submit(e: FormEvent) {
    e.preventDefault();
    setState({ busy: true });
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setState({ done: true });
    } catch (err) {
      setState({ error: message(err) });
    }
  }
  return (
    <form className="panel" onSubmit={submit}>
      <h3>Change password</h3>
      <input type="text" autoComplete="username" value={username} readOnly hidden /> {/* tells password managers which account */}
      <PasswordInput id="pw-current" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
      <PasswordInput id="pw-next" label="New password (at least 8 characters)" value={next} onChange={setNext} autoComplete="new-password" />
      {state.error && <div className="error" role="alert">{state.error}</div>}
      {state.done && <div className="good small">✓ Password changed. Other devices have been signed out.</div>}
      <div><button className="btn-secondary" disabled={state.busy}>Change password</button></div>
    </form>
  );
}

function DangerZone() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  async function remove(e: FormEvent) {
    e.preventDefault();
    if (!confirm('Delete your account and all the progress saved in it? This can’t be undone.')) return;
    try {
      await deleteAccount(password);
      navigate('');
    } catch (err) {
      setError(message(err));
    }
  }
  return (
    <details className="panel danger">
      <summary>Delete account</summary>
      <form onSubmit={remove} className="danger-form">
        <p className="muted small acc-p">Deletes your account and the progress saved in it, on the server and on this device.</p>
        <PasswordInput id="del-pass" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
        {error && <div className="error" role="alert">{error}</div>}
        <div><button className="btn-danger">Delete my account</button></div>
      </form>
    </details>
  );
}

function SignedIn({ account }: { account: AccountState }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const user = account.user!;
  async function out() {
    setBusy(true);
    setError('');
    try {
      await signOut();
      navigate('');
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  }
  return (
    <div className="account">
      <header className="acc-head panel">
        <span className="avatar-letter big">{user.username[0]?.toUpperCase()}</span>
        <div className="acc-who">
          <h1>{user.username}</h1>
          <div className="muted small">Member since {new Date(user.created).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <div className="row acc-sync">
            <SyncBadge account={account} />
            <button className="btn-ghost small" onClick={() => void syncNow()} disabled={account.sync === 'syncing'}>Sync now</button>
          </div>
        </div>
        <div className="acc-out">
          <button className="btn-secondary" onClick={out} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button>
        </div>
      </header>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="acc-grid">
        <ChessComLink />
        <SavedSummary />
        <PasswordForm />
        <div className="acc-col">
          <section className="panel">
            <h3>Signing out</h3>
            <p className="muted small acc-p">Your progress stays safe in your account. Signing out removes this device’s copy, so the next person here starts fresh.</p>
          </section>
          <DangerZone />
        </div>
      </div>
    </div>
  );
}

export function AccountPage() {
  const account = useAccount();
  if (account.status === 'loading') return <div className="page-loading"><span className="spinner" /></div>;
  if (account.status === 'unavailable')
    return (
      <div className="empty">
        <h2>Accounts aren’t available here</h2>
        <p className="muted">This copy of the app has no account server. Your progress is saved on this device.</p>
      </div>
    );
  return account.status === 'signedIn' && account.user ? <SignedIn account={account} /> : <SignInForm />;
}
