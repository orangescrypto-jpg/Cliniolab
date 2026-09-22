'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FlashcardSetCard } from '@/components/flashcards/FlashcardSetCard';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import type { FlashcardSetWithStats } from '@/types';

interface FlashcardsClientProps {
  initialSets: FlashcardSetWithStats[];
  initialTotal: number;
  pageSize: number;
}

export function FlashcardsClient({ initialSets, initialTotal, pageSize }: FlashcardsClientProps) {
  const [sets, setSets] = useState<FlashcardSetWithStats[]>(initialSets);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);

  // Page 1 already arrived server-rendered (feature flag already checked
  // server-side, so this client never needs to re-check `enabled`).
  useEffect(() => {
    if (page === 1) {
      setSets(initialSets);
      setTotal(initialTotal);
      return;
    }
    setLoading(true);
    fetch(`/api/flashcards?page=${page}&pageSize=${pageSize}`)
      .then((res) => res.json())
      .then((data) => {
        setSets(data.sets ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, initialSets, initialTotal]);

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
      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} className="mt-10" />
    </div>
  );
}
