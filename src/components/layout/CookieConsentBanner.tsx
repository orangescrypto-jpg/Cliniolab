'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import type { CookieConsentSetting } from '@/types';

const CONSENT_COOKIE_NAME = 'cliniolab_cookie_consent';

function getConsentCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setConsentCookie(value: 'accepted' | 'declined') {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${CONSENT_COOKIE_NAME}=${value}; path=/; max-age=${oneYear}; SameSite=Lax`;
}

export function CookieConsentBanner() {
  const [setting, setSetting] = useState<CookieConsentSetting | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getConsentCookie()) return; // already accepted or declined

    fetch('/api/cookie-consent')
      .then((res) => res.json())
      .then((data) => {
        if (data.setting?.enabled) {
          setSetting(data.setting);
          setVisible(true);
        }
      })
      .catch(() => {
        // If settings can't be fetched, fail silently rather than blocking the page
      });
  }, []);

  function respond(choice: 'accepted' | 'declined') {
    setConsentCookie(choice);
    setVisible(false);
  }

  if (!visible || !setting) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-100 bg-white shadow-lg">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-600">
          {setting.message}{' '}
          <Link href={setting.policyUrl} className="font-medium text-pulse-600 hover:underline">
            {setting.policyLinkText}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="sm" onClick={() => respond('declined')}>
            {setting.declineButtonText}
          </Button>
          <Button variant="primary" size="sm" onClick={() => respond('accepted')}>
            {setting.acceptButtonText}
          </Button>
        </div>
      </div>
    </div>
  );
}
