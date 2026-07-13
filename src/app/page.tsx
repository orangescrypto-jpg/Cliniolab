'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LeaderboardList } from '@/components/quiz/LeaderboardList';
import { ResourceCard } from '@/components/resources/ResourceCard';
import { CategoryBlogSection } from '@/components/cms/CategoryBlogSection';
import { BlogPostCard } from '@/components/cms/BlogPostCard';
import { CategoryQuizSection } from '@/components/quiz/CategoryQuizSection';
import { DailyQuizBanner } from '@/components/layout/DailyQuizBanner';
import { BannerSlot } from '@/components/layout/BannerSlot';
import { ScholarOfTheDayCard } from '@/components/layout/ScholarOfTheDayCard';
import { AbbreviationsTeaser } from '@/components/layout/AbbreviationsTeaser';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth/AuthProvider';
import { JOB_CATEGORY_SLUG, SCHOLARSHIP_CATEGORY_SLUG } from '@/lib/constants/blogCategories';
import type { BlogPost, Category, LeaderboardEntry, Resource } from '@/types';

interface BlogCategoryOption { id: string; name: string; slug: string; sortOrder: number }

// Job/Scholarship get their own dedicated pages (/jobs, /scholarships)
// instead of a homepage section, so they're filtered out here.
const HOMEPAGE_EXCLUDED_SLUGS = new Set(['job', 'scholarship']);

export default function HomePage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [blogCategories, setBlogCategories] = useState<BlogCategoryOption[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true);
  const [leaderboardLabel, setLeaderboardLabel] = useState('Top Quiz Takers');
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourcesEnabled, setResourcesEnabled] = useState(true);
  const [jobPosts, setJobPosts] = useState<BlogPost[]>([]);
  const [scholarshipPosts, setScholarshipPosts] = useState<BlogPost[]>([]);

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

    fetch(`/api/blog?categorySlug=${JOB_CATEGORY_SLUG}`)
      .then((res) => res.json())
      .then((data) => setJobPosts((data.posts ?? []).slice(0, 2)))
      .catch(() => {});

    fetch(`/api/blog?categorySlug=${SCHOLARSHIP_CATEGORY_SLUG}`)
      .then((res) => res.json())
      .then((data) => setScholarshipPosts((data.posts ?? []).slice(0, 2)))
      .catch(() => {});
  }, []);

  const homepageBlogCategories = blogCategories.filter((c) => !HOMEPAGE_EXCLUDED_SLUGS.has(c.slug));

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-ink-100 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <p className="font-mono text-xs uppercase tracking-widest text-pulse-600">
            Clinical &amp; Nursing Learning Hub
          </p>
          <h1 className="mt-4 max-w-2xl font-display text-4xl font-semibold leading-tight text-ink-800 sm:text-5xl">
            Learn, revise, and test yourself for your clinical and nursing exams.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ink-500">
            In-depth articles and study guides across core sciences, clinical specialties, and
            nursing practice, paired with quizzes and computer-based test (CBT) simulations to
            put that knowledge to the test built and shared by students like you.
          </p>
          <div className="mt-8 flex gap-4">
            <Link href="/categories"><Button size="lg">Browse categories</Button></Link>
            <Link href={user ? '/quizzes/new' : '/login?next=%2Fquizzes%2Fnew'}>
              <Button size="lg" variant="secondary">Create a quiz</Button>
            </Link>
          </div>
        </div>
      </section>

      <BannerSlot placement="header" />

      <DailyQuizBanner />

      {/* Blog / education content, one section per fixed category (excluding Job/Scholarship) */}
      {homepageBlogCategories.map((category) => (
        <CategoryBlogSection
          key={category.id}
          categoryId={category.id}
          categorySlug={category.slug}
          categoryName={category.name}
        />
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

      {/* Jobs teaser */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold text-ink-800">Jobs</h2>
          <Link href="/jobs" className="text-sm font-medium text-pulse-600 hover:text-pulse-700">
            See more →
          </Link>
        </div>
        <p className="mt-2 text-sm text-ink-500">
          Clinical and nursing job openings curated for students and professionals.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {jobPosts.map((post) => (
            <BlogPostCard key={post.id} post={post} />
          ))}
          {jobPosts.length === 0 && (
            <p className="col-span-full text-sm text-ink-400">No job listings yet — check back soon.</p>
          )}
        </div>
      </section>

      {/* Scholarships teaser */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold text-ink-800">Scholarships</h2>
          <Link href="/scholarships" className="text-sm font-medium text-pulse-600 hover:text-pulse-700">
            See more →
          </Link>
        </div>
        <p className="mt-2 text-sm text-ink-500">
          Scholarship opportunities for nursing and clinical students.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {scholarshipPosts.map((post) => (
            <BlogPostCard key={post.id} post={post} />
          ))}
          {scholarshipPosts.length === 0 && (
            <p className="col-span-full text-sm text-ink-400">No scholarships yet — check back soon.</p>
          )}
        </div>
      </section>

      <AbbreviationsTeaser />
    </div>
  );
}
