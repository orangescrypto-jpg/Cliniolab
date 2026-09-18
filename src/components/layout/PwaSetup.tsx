'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DENIED_HINT_DISMISSED_KEY = 'push_denied_hint_dismissed_at';
const DENIED_HINT_RESHOW_AFTER_MS = 1000 * 60 * 60 * 24 * 14;

type BrowserKind = 'chrome' | 'firefox' | 'safari' | 'edge' | 'other';

function detectBrowser(): BrowserKind {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'edge';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Chrome\//.test(ua) || /CriOS\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'safari';
  return 'other';
}

const UNBLOCK_STEPS: Record<BrowserKind, string> = {
  chrome: 'Tap the lock/info icon next to the address bar → Permissions → Notifications → Allow.',
  edge: 'Tap the lock/info icon next to the address bar → Permissions for this site → Notifications → Allow.',
  firefox: 'Tap the lock icon next to the address bar → Permissions → Notifications → Allow.',
  safari: 'Open Settings → Safari → Notifications (or Websites → Notifications) and allow this site.',
  other: "Open your browser's site settings for this page and allow Notifications.",
};

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) {
    bytes[i] = rawData.charCodeAt(i);
  }
  return bytes;
}

/**
 * Registers the service worker on mount, and shows a small install banner
 * once the browser signals the app is installable (beforeinstallprompt).
 * Also offers a notification opt-in once a user is logged in.
 */
export function PwaSetup() {
  const { user } = useAuth();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showNotifyBanner, setShowNotifyBanner] = useState(false);
  const [subscribeFailed, setSubscribeFailedState] = useState(false);
  const [showDeniedHint, setShowDeniedHint] = useState(false);
  const [browser, setBrowser] = useState<BrowserKind>('other');

  function setSubscribeFailed(failed: boolean) {
    setSubscribeFailedState(failed);
    try {
      if (failed) {
        localStorage.setItem('push_subscribe_failed', '1');
      } else {
        localStorage.removeItem('push_subscribe_failed');
      }
    } catch {
      // localStorage unavailable (private mode etc.) - in-memory state still works for this session
    }
  }

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registration failures shouldn't break the app - PWA install and
        // push are progressive enhancements, not required functionality.
      });
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    setBrowser(detectBrowser());
  }, []);

  useEffect(() => {
    if (!user) return;
    if (typeof Notification === 'undefined') return;

    if (Notification.permission === 'denied') {
      // Browsers never re-prompt once denied, and re-calling
      // requestPermission() just resolves to "denied" again with no
      // UI — so there's no "ask again" path here, only pointing the
      // user at their own browser's site-settings toggle. Shown at
      // most every 14 days per dismissal, same reshow cadence as the
      // rest of this component's banners.
      let dismissedAt: string | null = null;
      try {
        dismissedAt = localStorage.getItem(DENIED_HINT_DISMISSED_KEY);
      } catch {
        // ignore - treat as not-dismissed if storage is unavailable
      }
      const recentlyDismissed = dismissedAt !== null && Date.now() - parseInt(dismissedAt, 10) < DENIED_HINT_RESHOW_AFTER_MS;
      if (!recentlyDismissed) setShowDeniedHint(true);
      return;
    }

    let failedBefore = false;
    try {
      failedBefore = localStorage.getItem('push_subscribe_failed') === '1';
    } catch {
      // ignore - treat as not-failed if storage is unavailable
    }

    if (Notification.permission === 'default' || (Notification.permission === 'granted' && failedBefore)) {
      setShowNotifyBanner(true);
    }
  }, [user]);

  function dismissDeniedHint() {
    setShowDeniedHint(false);
    try {
      localStorage.setItem(DENIED_HINT_DISMISSED_KEY, Date.now().toString());
    } catch {
      // ignore - dismissal just won't persist across reloads in this session
    }
  }

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    setShowInstallBanner(false);
    setInstallEvent(null);
  }

  async function handleEnableNotifications() {
    setShowNotifyBanner(false);
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    let vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      try {
        const res = await fetch('/api/push/vapid-public-key');
        const data = await res.json();
        vapidPublicKey = data.publicKey || undefined;
      } catch {
        // push not configured; permission alone is still useful for future setup
      }
    }
    if (!vapidPublicKey) return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    try {
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) {
        // Save failed server-side even though the browser granted permission
        // and created a push subscription. Re-show the banner next reload
        // so the user gets another chance, instead of silently losing push.
        setSubscribeFailed(true);
      } else {
        setSubscribeFailed(false);
      }
    } catch {
      setSubscribeFailed(true);
    }
  }

  return (
    <>
      {showInstallBanner && (
        <div className="fixed top-4 left-1/2 z-50 w-[92%] max-w-sm -translate-x-1/2 rounded-lg border border-ink-100 bg-white p-4 shadow-lg">
          <p className="text-sm font-medium text-ink-800">Install Cliniolab</p>
          <p className="mt-1 text-xs text-ink-500">Install to your phone for quick access.</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleInstall}
              className="rounded-md bg-pulse-500 px-3 py-1.5 text-xs font-medium text-white"
            >
              Install
            </button>
            <button
              onClick={() => setShowInstallBanner(false)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-ink-500"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {showNotifyBanner && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[92%] max-w-sm -translate-x-1/2 rounded-lg border border-ink-100 bg-white p-4 shadow-lg">
          <p className="text-sm font-medium text-ink-800">Stay in the loop</p>
          <p className="mt-1 text-xs text-ink-500">Get notified about comment replies and updates.</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleEnableNotifications}
              className="rounded-md bg-pulse-500 px-3 py-1.5 text-xs font-medium text-white"
            >
              Enable notifications
            </button>
            <button
              onClick={() => setShowNotifyBanner(false)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-ink-500"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {showDeniedHint && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[92%] max-w-sm -translate-x-1/2 rounded-lg border border-ink-100 bg-ink-800 p-4 text-white shadow-lg">
          <p className="text-sm font-medium">Notifications are blocked for this site</p>
          <p className="mt-1 text-xs text-ink-200">{UNBLOCK_STEPS[browser]}</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={dismissDeniedHint}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-ink-200 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </>
  );
}
