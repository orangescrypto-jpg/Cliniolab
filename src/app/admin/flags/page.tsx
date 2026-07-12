'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import type { Category, FeatureFlag } from '@/types';

export default function AdminFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [emailScope, setEmailScope] = useState<'general' | string>('general');
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/flags')
      .then((res) => res.json())
      .then((data) => {
        setFlags(data.flags ?? []);
        const drafts: Record<string, string> = {};
        for (const f of data.flags ?? []) drafts[f.key] = f.label ?? '';
        setLabelDrafts(drafts);
      });
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
  }, []);

  async function updateFlag(key: string, enabled: boolean, label?: string) {
    const res = await fetch('/api/admin/flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, enabled, label }),
    });
    if (res.ok) {
      const data = await res.json();
      setFlags(data.flags);
    }
  }

  async function sendLeaderboardEmails() {
    setSendingEmails(true);
    setEmailResult(null);
    try {
      const isGeneral = emailScope === 'general';
      const category = categories.find((c) => c.id === emailScope);
      const res = await fetch('/api/admin/send-leaderboard-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isGeneral
            ? { scope: 'general' }
            : { scope: 'category', categoryId: emailScope, label: `${category?.name ?? ''} Leaders` }
        ),
      });
      const data = await res.json();
      setEmailResult(res.ok ? `Sent to ${data.sent} recipients.` : data.error);
    } finally {
      setSendingEmails(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Feature flags</h1>
      <p className="mt-2 text-ink-500">Turn features on/off sitewide, and rename display labels.</p>

      <div className="mt-6 space-y-3">
        {flags.map((flag) => (
          <Card key={flag.key} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-4">
              <Toggle checked={flag.enabled} onChange={(v) => updateFlag(flag.key, v, flag.label ?? undefined)} />
              <span className="font-mono text-xs text-ink-400">{flag.key}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={labelDrafts[flag.key] ?? ''}
                onChange={(e) => setLabelDrafts((prev) => ({ ...prev, [flag.key]: e.target.value }))}
                className="rounded-md border border-ink-100 px-3 py-1.5 text-sm focus:border-pulse-400 focus:outline-none"
              />
              <button
                onClick={() => updateFlag(flag.key, flag.enabled, labelDrafts[flag.key])}
                className="text-xs font-medium text-pulse-600 hover:text-pulse-700"
              >
                Save label
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
