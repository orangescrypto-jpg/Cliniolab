'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
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
    if (!user) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      setShowNotifyBanner(true);
    }
  }, [user]);

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

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) return; // push not configured; permission alone is still useful for future setup

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    });
  }

  return (
    <>
      {showInstallBanner && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[92%] max-w-sm -translate-x-1/2 rounded-lg border border-ink-100 bg-white p-4 shadow-lg">
          <p className="text-sm font-medium text-ink-800">Install Cliniolab</p>
          <p className="mt-1 text-xs text-ink-500">Add to your home screen for quick access.</p>
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
    </>
  );
}
