// Installing the hosted app: Chrome and Edge (Android, computers) offer an install prompt the page can trigger;
// on iPhone and iPad it is Safari's Share → Add to Home Screen, which pages can only explain.

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((f) => f());

/** Must run at startup: the browser fires its install event early, once. */
export function initInstall() {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // our own button on the Offline page instead of the browser's mini banner
    deferred = e as InstallPrompt;
    changed();
  });
  addEventListener('appinstalled', () => {
    deferred = null;
    changed();
  });
}

export const canPromptInstall = () => deferred !== null;

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  changed();
  return outcome === 'accepted';
}

export function onInstallChange(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

export function platform(): 'ios' | 'android' | 'other' {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  // iPadOS Safari reports itself as a Mac; touch support gives it away
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return 'other';
}

/** Running as an installed app (Home Screen / app window) rather than in a browser tab. */
export const isInstalled = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
