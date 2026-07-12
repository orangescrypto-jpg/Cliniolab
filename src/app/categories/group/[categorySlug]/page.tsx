'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { QuizCard } from '@/components/quiz/QuizCard';
import { LeaderboardList } from '@/components/quiz/LeaderboardList';
import type { Category, LeaderboardEntry, QuizWithStats } from '@/types';

export default function CategoryGroupPage() {
  const params = useParams<{ categorySlug: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [quizzes, setQuizzes] = useState<QuizWithStats[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true);

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        const cat = (data.categories as Category[]).find((c) => c.slug === params.categorySlug) ?? null;
        setCategory(cat);
        if (cat) {
          fetch(`/api/quizzes?categoryId=${cat.id}`)
            .then((res) => res.json())
            .then((quizData) => setQuizzes(quizData.quizzes ?? []));
          fetch(`/api/leaderboard/category/${cat.id}`)
            .then((res) => res.json())
            .then((lbData) => {
              setLeaderboardEnabled(lbData.enabled);
              setLeaderboard(lbData.entries ?? []);
            });
        }
      });
  }, [params.categorySlug]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">
        {category?.name ?? 'Loading…'}
      </h1>
      {category?.description && <p className="mt-2 text-ink-500">{category.description}</p>}

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {quizzes.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} />
            ))}
            {quizzes.length === 0 && (
              <p className="col-span-full text-sm text-ink-400">No quizzes in this category yet.</p>
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
