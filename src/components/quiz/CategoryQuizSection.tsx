'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { QuizCard } from '@/components/quiz/QuizCard';
import type { Category, QuizWithStats } from '@/types';

export function CategoryQuizSection({ category }: { category: Category }) {
  const [quizzes, setQuizzes] = useState<QuizWithStats[]>([]);

  useEffect(() => {
    fetch(`/api/quizzes?categoryId=${category.id}&limit=4`)
      .then((res) => res.json())
      .then((data) => setQuizzes(data.quizzes ?? []));
  }, [category.id]);

  if (quizzes.length === 0) return null; // don't show empty category sections

  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold text-ink-800">{category.name}</h2>
        <Link
          href={`/categories/group/${category.slug}`}
          className="text-sm font-medium text-pulse-600 hover:text-pulse-700"
        >
          See more →
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {quizzes.map((quiz) => (
          <QuizCard key={quiz.id} quiz={quiz} />
        ))}
      </div>
    </section>
  );
}
