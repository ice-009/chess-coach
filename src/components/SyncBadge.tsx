import type { AccountState } from '../lib/account';
import { ago } from '../lib/activity';

/** "✓ Synced 2 min ago" and friends, for the account page and the dashboard header. */
export function SyncBadge({ account, compact }: { account: AccountState; compact?: boolean }) {
  if (account.status === 'loading') return null;
  if (account.status === 'signedOut' || account.status === 'unavailable')
    return compact ? (
      <a className="btn-green head-signin" href="#/account">Sign in</a>
    ) : (
      <a className="sync-badge off" href="#/account">Not signed in · progress stays on this device</a>
    );
  const [cls, text] =
    account.sync === 'syncing' ? ['busy', 'Syncing…'] :
    account.sync === 'offline' ? ['off', 'Offline · saved on this device'] :
    account.sync === 'error' ? ['bad', 'Couldn’t sync · will retry'] :
    ['ok', account.lastSync ? `Synced ${ago(account.lastSync)}` : 'Signed in'];
  return <a className={`sync-badge ${cls}`} href="#/account" title="Your account">{cls === 'busy' ? <span className="spinner tiny" /> : <span className="sync-dot" />}{text}</a>;
}
