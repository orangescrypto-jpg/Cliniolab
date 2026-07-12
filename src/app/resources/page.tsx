'use client';

import { useEffect, useState } from 'react';
import { ResourceCard } from '@/components/resources/ResourceCard';
import type { Resource } from '@/types';

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [filter, setFilter] = useState<'all' | 'book' | 'past_question_pack'>('all');

  useEffect(() => {
    fetch('/api/resources')
      .then((res) => res.json())
      .then((data) => {
        setEnabled(data.enabled);
        setResources(data.resources ?? []);
      });
  }, []);

  const filtered = resources.filter((r) => filter === 'all' || r.kind === filter);

  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="text-sm text-ink-400">Resources are currently unavailable.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">Books &amp; Past Questions</h1>
      <p className="mt-2 text-ink-500">
        Study guides, e-books, and institution-specific past question packs.
      </p>

      <div className="mt-6 flex gap-2">
        {(['all', 'book', 'past_question_pack'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              filter === f ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600'
            }`}
          >
            {f === 'all' ? 'All' : f === 'book' ? 'Books' : 'Past Question Packs'}
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {filtered.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
        {filtered.length === 0 && <p className="col-span-full text-sm text-ink-400">No resources yet.</p>}
      </div>
    </div>
  );
}
