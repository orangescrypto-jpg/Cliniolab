'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { QuizCard } from '@/components/quiz/QuizCard';
import { LeaderboardList } from '@/components/quiz/LeaderboardList';
import { Pagination } from '@/components/ui/Pagination';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { Category, LeaderboardEntry, QuizWithStats } from '@/types';

const PAGE_SIZE = 25;

export default function CategoryGroupPage() {
  const params = useParams<{ categorySlug: string }>();
  const { user } = useAuth();
  const [category, setCategory] = useState<Category | null>(null);
  const [quizzes, setQuizzes] = useState<QuizWithStats[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true);
  const [leaderboardCurrentUserRank, setLeaderboardCurrentUserRank] = useState<number | null>(null);

  // Category lookup + leaderboard only need to happen once per category,
  // not on every page change.
  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        const cat = (data.categories as Category[]).find((c) => c.slug === params.categorySlug) ?? null;
        setCategory(cat);
        if (cat) {
          fetch(`/api/leaderboard/category/${cat.id}`)
            .then((res) => res.json())
            .then((lbData) => {
              setLeaderboardEnabled(lbData.enabled);
              setLeaderboard(lbData.entries ?? []);
              setLeaderboardCurrentUserRank(lbData.currentUserRank ?? null);
            });
        }
      });
  }, [params.categorySlug]);

  // Quiz list re-fetches whenever the category resolves or the page
  // changes. Resets to page 1 whenever the category itself changes (e.g.
  // navigating directly between two category pages without a full reload).
  useEffect(() => {
    if (!category) return;
    fetch(`/api/quizzes?categoryId=${category.id}&page=${page}&pageSize=${PAGE_SIZE}`)
      .then((res) => res.json())
      .then((data) => {
        setQuizzes(data.quizzes ?? []);
        setTotal(data.total ?? 0);
      });
  }, [category, page]);

  useEffect(() => {
    setPage(1);
  }, [category?.id]);

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
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={(p) => {
              setPage(p);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="mt-8"
          />
        </div>
        {leaderboardEnabled && category && (
          <div>
            <LeaderboardList
              entries={leaderboard}
              title={`${category.name} Leaders`}
              currentUserId={user?.id ?? null}
              currentUserRank={leaderboardCurrentUserRank}
            />
          </div>
        )}
      </div>
    </div>
  );
}
