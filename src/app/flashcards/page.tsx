'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FlashcardSetCard } from '@/components/flashcards/FlashcardSetCard';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import type { FlashcardSetWithStats } from '@/types';

const PAGE_SIZE = 12;

export default function FlashcardsPage() {
  const [sets, setSets] = useState<FlashcardSetWithStats[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/flashcards?page=${page}&pageSize=${PAGE_SIZE}`)
      .then((res) => res.json())
      .then((data) => {
        setEnabled(data.enabled ?? true);
        setSets(data.sets ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page]);

  if (!loading && !enabled) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Flashcards unavailable</h1>
        <p className="mt-2 text-ink-500">This feature is currently turned off.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold text-ink-800">Flashcards</h1>
        <Link href="/flashcards/new">
          <Button>Create a flashcard set</Button>
        </Link>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {loading && sets.length === 0 && (
          <p className="col-span-full text-sm text-ink-400">Loading…</p>
        )}
        {sets.map((set) => (
          <FlashcardSetCard key={set.id} set={set} />
        ))}
        {!loading && sets.length === 0 && (
          <p className="col-span-full text-sm text-ink-400">No public flashcard sets yet.</p>
        )}
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} className="mt-10" />
    </div>
  );
}
