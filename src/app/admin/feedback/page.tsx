'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { Feedback, FeedbackStatus } from '@/types';

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);

  function load() {
    fetch('/api/admin/feedback')
      .then((res) => res.json())
      .then((data) => setFeedback(data.feedback ?? []));
  }

  useEffect(load, []);

  async function updateStatus(id: string, status: FeedbackStatus) {
    const res = await fetch(`/api/admin/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) load();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Feedback</h1>
      <div className="mt-6 space-y-3">
        {feedback.map((f) => (
          <Card key={f.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <span className="rounded bg-ink-50 px-2 py-0.5 text-xs text-ink-500">{f.category}</span>
              <span className="ml-2 rounded bg-flag-50 px-2 py-0.5 text-xs text-flag-600">{f.status}</span>
              <p className="mt-1 text-sm text-ink-700">{f.message}</p>
              <p className="mt-1 text-xs text-ink-400">
                {f.pageUrl ?? 'unknown page'} · {new Date(f.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => updateStatus(f.id, 'reviewed')}>Reviewed</Button>
              <Button size="sm" onClick={() => updateStatus(f.id, 'resolved')}>Resolved</Button>
            </div>
          </Card>
        ))}
        {feedback.length === 0 && <p className="text-sm text-ink-400">No feedback yet.</p>}
      </div>
    </div>
  );
}
