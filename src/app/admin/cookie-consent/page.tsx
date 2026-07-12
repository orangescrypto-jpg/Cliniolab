'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';

export default function AdminCookieConsentPage() {
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState('');
  const [policyLinkText, setPolicyLinkText] = useState('');
  const [policyUrl, setPolicyUrl] = useState('');
  const [acceptButtonText, setAcceptButtonText] = useState('');
  const [declineButtonText, setDeclineButtonText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/cookie-consent')
      .then((res) => res.json())
      .then((data) => {
        const s = data.setting;
        if (s) {
          setEnabled(s.enabled);
          setMessage(s.message);
          setPolicyLinkText(s.policyLinkText);
          setPolicyUrl(s.policyUrl);
          setAcceptButtonText(s.acceptButtonText);
          setDeclineButtonText(s.declineButtonText);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaved(false);
    const res = await fetch('/api/admin/cookie-consent', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled,
        message,
        policyLinkText,
        policyUrl,
        acceptButtonText,
        declineButtonText,
      }),
    });
    if (res.ok) setSaved(true);
  }

  if (loading) return null;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Cookie consent banner</h1>
      <p className="mt-2 text-ink-500">
        Shown to visitors on their first visit until they accept or decline. Their choice is
        remembered so the banner won&apos;t reappear.
      </p>

      <Card className="mt-6 space-y-4 p-5">
        <Toggle checked={enabled} onChange={setEnabled} label="Show the cookie consent banner" />

        <div>
          <label className="text-sm font-medium text-ink-700">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-ink-700">Policy link text</label>
            <input
              value={policyLinkText}
              onChange={(e) => setPolicyLinkText(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700">Policy link URL</label>
            <input
              value={policyUrl}
              onChange={(e) => setPolicyUrl(e.target.value)}
              placeholder="/privacy"
              className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700">Accept button text</label>
            <input
              value={acceptButtonText}
              onChange={(e) => setAcceptButtonText(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700">Decline button text</label>
            <input
              value={declineButtonText}
              onChange={(e) => setDeclineButtonText(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
            />
          </div>
        </div>

        <Button size="sm" onClick={save}>Save</Button>
        {saved && <span className="ml-3 text-xs text-pulse-600">Saved</span>}
      </Card>
    </div>
  );
}
