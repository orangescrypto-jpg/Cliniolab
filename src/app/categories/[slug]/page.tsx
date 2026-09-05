'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { QuizCard } from '@/components/quiz/QuizCard';
import { LeaderboardList } from '@/components/quiz/LeaderboardList';
import { Pagination } from '@/components/ui/Pagination';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { Category, LeaderboardEntry, QuizWithStats, Subcategory } from '@/types';

const PAGE_SIZE = 25;

function SubcategoryPageContent() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const categorySlug = searchParams.get('category');
  const { user } = useAuth();

  const [subcategory, setSubcategory] = useState<Subcategory | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [quizzes, setQuizzes] = useState<QuizWithStats[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true);
  const [leaderboardCurrentUserRank, setLeaderboardCurrentUserRank] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        const cat = (data.categories as Category[]).find((c) => c.slug === categorySlug) ?? null;
        setCategory(cat);
        const sub = (data.subcategories as Subcategory[]).find((s) => s.slug === params.slug) ?? null;
        setSubcategory(sub);

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
  }, [params.slug, categorySlug]);

  // Quiz list re-fetches whenever the subcategory resolves or the page
  // changes, kept separate from the lookup above so paging doesn't
  // re-trigger the category/subcategory/leaderboard fetch every time.
  useEffect(() => {
    if (!subcategory) return;
    fetch(`/api/quizzes?subcategoryId=${subcategory.id}&page=${page}&pageSize=${PAGE_SIZE}`)
      .then((res) => res.json())
      .then((data) => {
        setQuizzes(data.quizzes ?? []);
        setTotal(data.total ?? 0);
      });
  }, [subcategory, page]);

  useEffect(() => {
    setPage(1);
  }, [subcategory?.id]);

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

export default function SubcategoryPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-6 py-16">
          <p className="text-sm text-ink-400">Loading…</p>
        </div>
      }
    >
      <SubcategoryPageContent />
    </Suspense>
  );
}
