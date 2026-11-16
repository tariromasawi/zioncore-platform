import { useEffect, useState } from 'react';
import { isAppleTouchDevice, isStandalonePwa } from '@/lib/pwa-install';
import './pwa-install-prompt.css';

type InstallChoice = { outcome: 'accepted' | 'dismissed' };
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

const DISMISSED_KEY = 'zioncore-pwa-install-dismissed';

export default function PwaInstallPrompt() {
  const [mode, setMode] = useState<'hidden' | 'install' | 'ios'>('hidden');
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  useEffect(() => {
    const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
    if (isStandalonePwa(
      window.matchMedia('(display-mode: standalone)').matches,
      navigatorWithStandalone.standalone,
    )) return;

    try {
      if (window.localStorage.getItem(DISMISSED_KEY) === '1') return;
    } catch {
      // Installation remains available for this visit when storage is unavailable.
    }

    if (isAppleTouchDevice(
      window.navigator.userAgent,
      window.navigator.platform,
      window.navigator.maxTouchPoints,
    )) setMode('ios');

    const onBeforeInstallPrompt = (event: Event) => {
      const candidate = event as Partial<BeforeInstallPromptEvent>;
      if (typeof candidate.prompt !== 'function') return;
      event.preventDefault();
      setInstallEvent(candidate as BeforeInstallPromptEvent);
      setMode('install');
    };

    const onInstalled = () => {
      setMode('hidden');
      setInstallEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setMode('hidden');
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // The prompt can still be dismissed for the current visit.
    }
  };

  const install = async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } finally {
      setInstallEvent(null);
      setMode('hidden');
    }
  };

  if (mode === 'hidden') return null;

  return (
    <aside className="zc-install-prompt" aria-label="Install ZionCore">
      <div className="zc-install-copy">
        <strong>Keep ZionCore close</strong>
        <span>Install for one-tap access from your home screen.</span>
        {mode === 'ios' && (
          <span
            id="zc-install-help"
            className="zc-install-help"
            hidden={!instructionsOpen}
          >
            In Safari, tap Share, then choose Add to Home Screen.
          </span>
        )}
      </div>
      <div className="zc-install-actions">
        {mode === 'install' ? (
          <button type="button" className="zc-install-action" onClick={() => void install()}>
            Install
          </button>
        ) : (
          <button
            type="button"
            className="zc-install-action"
            aria-expanded={instructionsOpen}
            aria-controls="zc-install-help"
            onClick={() => setInstructionsOpen(open => !open)}
          >
            Add to Home Screen
          </button>
        )}
        <button type="button" className="zc-install-dismiss" onClick={dismiss} aria-label="Dismiss install prompt">
          ×
        </button>
      </div>
    </aside>
  );
}
