'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LeaderboardList } from '@/components/quiz/LeaderboardList';
import { ResourceCard } from '@/components/resources/ResourceCard';
import { CategoryBlogSection } from '@/components/cms/CategoryBlogSection';
import { CategoryQuizSection } from '@/components/quiz/CategoryQuizSection';
import { DailyQuizBanner } from '@/components/layout/DailyQuizBanner';
import { BannerSlot } from '@/components/layout/BannerSlot';
import { ScholarOfTheDayCard } from '@/components/layout/ScholarOfTheDayCard';
import { AbbreviationsTeaser } from '@/components/layout/AbbreviationsTeaser';
import { Button } from '@/components/ui/Button';
import type { Category, LeaderboardEntry, Resource } from '@/types';

interface BlogCategoryOption { id: string; name: string; slug: string; sortOrder: number }

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [blogCategories, setBlogCategories] = useState<BlogCategoryOption[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true);
  const [leaderboardLabel, setLeaderboardLabel] = useState('Top Quiz Takers');
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourcesEnabled, setResourcesEnabled] = useState(true);

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));

    fetch('/api/blog-categories')
      .then((res) => res.json())
      .then((data) => setBlogCategories(data.categories ?? []));

    fetch('/api/leaderboard/general')
      .then((res) => res.json())
      .then((data) => {
        setLeaderboardEnabled(data.enabled);
        setLeaderboard(data.entries ?? []);
      });

    fetch('/api/resources?limit=5')
      .then((res) => res.json())
      .then((data) => {
        setResourcesEnabled(data.enabled);
        setResources(data.resources ?? []);
      });

    fetch('/api/admin/flags')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const flag = data?.flags?.find((f: { key: string }) => f.key === 'leaderboard_general');
        if (flag?.label) setLeaderboardLabel(flag.label);
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-ink-100 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <p className="font-mono text-xs uppercase tracking-widest text-pulse-600">
            Clinical &amp; Nursing CBT Practice
          </p>
          <h1 className="mt-4 max-w-2xl font-display text-4xl font-semibold leading-tight text-ink-800 sm:text-5xl">
            Study smarter for your clinical and nursing exams.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ink-500">
            Quizzes and computer-based test (CBT) simulations across core sciences, clinical
            specialties, nursing practice, and board exam prep — built and shared by students
            like you.
          </p>
          <div className="mt-8 flex gap-4">
            <Link href="/categories"><Button size="lg">Browse categories</Button></Link>
            <Link href="/register"><Button size="lg" variant="secondary">Create a quiz</Button></Link>
          </div>
        </div>
      </section>

      <BannerSlot placement="header" />

      <DailyQuizBanner />

      {/* Blog / education content, one section per fixed category */}
      {blogCategories.map((category) => (
        <CategoryBlogSection key={category.id} category={category.name} />
      ))}

      <div className="chart-strip mx-auto max-w-7xl text-ink-200" aria-hidden />

      {/* Quizzes, one section per top-level quiz category */}
      {categories.map((category) => (
        <CategoryQuizSection key={category.id} category={category} />
      ))}

      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-center justify-between py-4">
          <Link href="/quizzes" className="text-sm font-medium text-pulse-600 hover:text-pulse-700">
            Browse all quizzes →
          </Link>
        </div>
      </div>

      {/* General leaderboard - across all categories */}
      {leaderboardEnabled && (
        <section className="border-y border-ink-100 bg-ink-50/40">
          <div className="mx-auto max-w-3xl px-6 py-16">
            <h2 className="font-display text-2xl font-semibold text-ink-800">{leaderboardLabel}</h2>
            <p className="mt-1 text-sm text-ink-500">Top performers across every category.</p>
            <div className="mt-6">
              <LeaderboardList entries={leaderboard} title={leaderboardLabel} />
            </div>
          </div>
        </section>
      )}

      <ScholarOfTheDayCard />

      {/* Resources */}
      {resourcesEnabled && (
        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold text-ink-800">Books &amp; Past Questions</h2>
            <Link href="/resources" className="text-sm font-medium text-pulse-600 hover:text-pulse-700">
              See more →
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {resources.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
            {resources.length === 0 && (
              <p className="col-span-full text-sm text-ink-400">No resources yet.</p>
            )}
          </div>
        </section>
      )}

      <AbbreviationsTeaser />
    </div>
  );
}
