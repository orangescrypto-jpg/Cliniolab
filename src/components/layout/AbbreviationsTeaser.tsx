'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import type { MedicalAbbreviation } from '@/types';

export function AbbreviationsTeaser() {
  const [abbreviations, setAbbreviations] = useState<MedicalAbbreviation[]>([]);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    fetch('/api/flags/medical_abbreviations')
      .then((res) => res.json())
      .then((data) => setEnabled(data.enabled));
    fetch('/api/abbreviations?random=5')
      .then((res) => res.json())
      .then((data) => setAbbreviations(data.abbreviations ?? []));
  }, []);

  if (!enabled || abbreviations.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold text-ink-800">Medical Abbreviations</h2>
        <Link href="/abbreviations" className="text-sm font-medium text-pulse-600 hover:text-pulse-700">
          See all →
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {abbreviations.map((a) => (
          <Card key={a.id} className="flex items-start gap-3 p-4">
            <span className="font-mono text-sm font-semibold text-pulse-600">{a.abbreviation}</span>
            <p className="text-sm text-ink-600">{a.meaning}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
