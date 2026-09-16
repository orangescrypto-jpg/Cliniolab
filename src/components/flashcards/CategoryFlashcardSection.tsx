'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FeaturedFlashcardSetCard, CompactFlashcardSetCard } from '@/components/flashcards/FlashcardSetCard';
import type { Category, FlashcardSetWithStats } from '@/types';

/** Sits inside each category's homepage block, labelled "Flashcard", right alongside that category's quiz section. */
export function CategoryFlashcardSection({ category }: { category: Category }) {
  const [sets, setSets] = useState<FlashcardSetWithStats[]>([]);

  useEffect(() => {
    fetch(`/api/flashcards?categoryId=${category.id}&limit=7`)
      .then((res) => res.json())
      .then((data) => setSets(data.sets ?? []));
  }, [category.id]);

  if (sets.length === 0) return null;

  const [featured, ...rest] = sets;

  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-ink-800">
          {category.name} <span className="text-pulse-600">· Flashcard</span>
        </h2>
        <Link
          href={`/categories/group/${category.slug}?tab=flashcards`}
          className="text-sm font-medium text-pulse-600 hover:text-pulse-700"
        >
          See more →
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]">
        <FeaturedFlashcardSetCard set={featured} />
        {rest.length > 0 && (
          <div className="divide-y divide-ink-100">
            {rest.map((set) => (
              <CompactFlashcardSetCard key={set.id} set={set} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
