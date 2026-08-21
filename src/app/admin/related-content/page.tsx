'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import type { RelatedQuizzesSetting, RelatedPostsSetting } from '@/types';

const DEFAULT_QUIZ_SETTING: RelatedQuizzesSetting = { enabled: true, count: 6, disabledCategoryIds: [] };
const DEFAULT_POSTS_SETTING: RelatedPostsSetting = { enabled: true, count: 4 };

interface BlogCategoryOption {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export default function AdminRelatedContentPage() {
  const [quizPage, setQuizPage] = useState<RelatedQuizzesSetting>(DEFAULT_QUIZ_SETTING);
  const [blogPage, setBlogPage] = useState<RelatedQuizzesSetting>(DEFAULT_QUIZ_SETTING);
  const [relatedPosts, setRelatedPosts] = useState<RelatedPostsSetting>(DEFAULT_POSTS_SETTING);
  const [blogCategories, setBlogCategories] = useState<BlogCategoryOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/related-quizzes')
      .then((res) => res.json())
      .then((data) => {
        if (data.quizPage) setQuizPage({ disabledCategoryIds: [], ...data.quizPage });
        if (data.blogPage) setBlogPage({ disabledCategoryIds: [], ...data.blogPage });
        if (data.relatedPosts) setRelatedPosts(data.relatedPosts);
      });
    fetch('/api/blog-categories')
      .then((res) => res.json())
      .then((data) => setBlogCategories(data.categories ?? []));
  }, []);

  function toggleDisabledCategory(categoryId: string, disabled: boolean) {
    setBlogPage((prev) => {
      const current = new Set(prev.disabledCategoryIds ?? []);
      if (disabled) current.add(categoryId);
      else current.delete(categoryId);
      return { ...prev, disabledCategoryIds: Array.from(current) };
    });
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/related-quizzes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizPage, blogPage, relatedPosts }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const disabledSet = new Set(blogPage.disabledCategoryIds ?? []);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Related content</h1>
      <p className="mt-2 text-ink-500">
        Controls the &ldquo;related quizzes&rdquo; grid and &ldquo;related posts&rdquo; list shown
        below quizzes and blog posts.
      </p>

      <Card className="mt-6 space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold text-ink-800">On quiz pages</h2>
        <Toggle
          checked={quizPage.enabled}
          onChange={(enabled) => setQuizPage((prev) => ({ ...prev, enabled }))}
          label="Show related quizzes below a quiz"
        />
        <div>
          <label className="text-sm font-medium text-ink-700">Number of quizzes to show</label>
          <input
            type="number"
            min={1}
            max={12}
            value={quizPage.count}
            onChange={(e) =>
              setQuizPage((prev) => ({ ...prev, count: Math.min(12, Math.max(1, Number(e.target.value) || 1)) }))
            }
            className="mt-1 w-32 rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          />
        </div>
      </Card>

      <Card className="mt-4 space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold text-ink-800">On blog posts</h2>
        <Toggle
          checked={blogPage.enabled}
          onChange={(enabled) => setBlogPage((prev) => ({ ...prev, enabled }))}
          label="Show related quizzes below a blog post"
        />
        <div>
          <label className="text-sm font-medium text-ink-700">Number of quizzes to show</label>
          <input
            type="number"
            min={1}
            max={12}
