'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import type { MedicalAbbreviation } from '@/types';

export default function AbbreviationsPage() {
  const [abbreviations, setAbbreviations] = useState<MedicalAbbreviation[]>([]);
  const [search, setSearch] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/flags/medical_abbreviations')
      .then((res) => res.json())
      .then((data) => setEnabled(data.enabled))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetch(`/api/abbreviations${search ? `?search=${encodeURIComponent(search)}` : ''}`)
        .then((res) => res.json())
        .then((data) => setAbbreviations(data.abbreviations ?? []));
    }, 200); // small debounce so typing doesn't fire a request per keystroke
    return () => clearTimeout(timeout);
  }, [search]);

  if (loaded && !enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Medical Abbreviations</h1>
        <p className="mt-2 text-ink-500">This page isn&apos;t available right now.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">Medical Abbreviations</h1>
      <p className="mt-2 text-ink-500">A quick-reference glossary of common clinical abbreviations.</p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search an abbreviation or meaning…"
        className="mt-6 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
      />

      <div className="mt-6 space-y-2">
        {abbreviations.map((a) => (
          <Card key={a.id} className="flex items-start gap-4 p-4">
            <span className="w-20 shrink-0 font-mono text-sm font-semibold text-pulse-600">
              {a.abbreviation}
            </span>
            <div>
              <p className="text-sm text-ink-700">{a.meaning}</p>
              {a.category && <p className="mt-0.5 text-xs text-ink-400">{a.category}</p>}
            </div>
          </Card>
        ))}
        {abbreviations.length === 0 && (
          <p className="text-sm text-ink-400">
            {search ? 'No matches found.' : 'No abbreviations added yet.'}
          </p>
        )}
      </div>
    </div>
  );
}
