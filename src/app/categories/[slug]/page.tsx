'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { QuizCard } from '@/components/quiz/QuizCard';
import { LeaderboardList } from '@/components/quiz/LeaderboardList';
import type { Category, LeaderboardEntry, QuizWithStats, Subcategory } from '@/types';

export default function SubcategoryPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const categorySlug = searchParams.get('category');

  const [subcategory, setSubcategory] = useState<Subcategory | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [quizzes, setQuizzes] = useState<QuizWithStats[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true);

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        const cat = (data.categories as Category[]).find((c) => c.slug === categorySlug) ?? null;
        setCategory(cat);
        const sub = (data.subcategories as Subcategory[]).find((s) => s.slug === params.slug) ?? null;
        setSubcategory(sub);

        if (sub) {
          fetch(`/api/quizzes?subcategoryId=${sub.id}`)
            .then((res) => res.json())
            .then((quizData) => setQuizzes(quizData.quizzes ?? []));
        }
        if (cat) {
          fetch(`/api/leaderboard/category/${cat.id}`)
            .then((res) => res.json())
            .then((lbData) => {
              setLeaderboardEnabled(lbData.enabled);
              setLeaderboard(lbData.entries ?? []);
            });
        }
      });
  }, [params.slug, categorySlug]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      {category && <p className="font-mono text-xs uppercase tracking-widest text-pulse-600">{category.name}</p>}
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink-800">
        {subcategory?.name ?? 'Loading…'}
      </h1>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {quizzes.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} />
            ))}
            {quizzes.length === 0 && (
              <p className="col-span-full text-sm text-ink-400">No quizzes in this subcategory yet.</p>
            )}
          </div>
        </div>
        {leaderboardEnabled && category && (
          <div>
            <LeaderboardList entries={leaderboard} title={`${category.name} Leaders`} />
          </div>
        )}
      </div>
    </div>
  );
}
