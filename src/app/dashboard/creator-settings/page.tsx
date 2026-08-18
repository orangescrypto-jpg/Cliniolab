'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth/AuthProvider';

export default function CreatorSettingsPage() {
  const { user, loading } = useAuth();
  const [contactPhone, setContactPhone] = useState('');
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch('/api/user/contact-phone')
      .then((res) => res.json())
      .then((data) => setContactPhone(data.contactPhone ?? ''));
  }, [user]);

  async function submit() {
    setSaved(false);
    setSubmitting(true);
    try {
      await fetch('/api/user/contact-phone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactPhone }),
      });
      setSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;
  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Login required</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="font-display text-2xl font-semibold text-ink-800">Creator settings</h1>
      <p className="mt-2 text-ink-500">
        Add a contact number for people who take your quizzes. It appears as &quot;For inquiries
        or assistance, contact: …&quot; on the share text of every public quiz you create — update
        it here any time and it applies to all of them immediately.
      </p>

      <Card className="mt-6 space-y-3 p-5">
        <input
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder="e.g. 08012345678"
          className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
        />
        <p className="text-xs text-ink-400">Leave blank to remove the contact line from your share text.</p>
        {saved && <p className="text-sm text-pulse-600">Saved.</p>}
        <Button onClick={submit} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save contact number'}
        </Button>
      </Card>
    </div>
  );
}
