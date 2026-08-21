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
            value={blogPage.count}
            onChange={(e) =>
              setBlogPage((prev) => ({ ...prev, count: Math.min(12, Math.max(1, Number(e.target.value) || 1)) }))
            }
            className="mt-1 w-32 rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          />
        </div>

        {blogPage.enabled && blogCategories.length > 0 && (
          <div>
            <label className="text-sm font-medium text-ink-700">
              Turn off related quizzes for specific categories
            </label>
            <p className="mt-0.5 text-xs text-ink-400">
              Useful for categories like Job, Scholarship, or Clinical Pearls, where a
              &ldquo;practice quiz&rdquo; suggestion doesn&apos;t really fit.
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {blogCategories.map((cat) => (
                <label key={cat.id} className="flex items-center gap-2 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    checked={disabledSet.has(cat.id)}
                    onChange={(e) => toggleDisabledCategory(cat.id, e.target.checked)}
                    className="accent-pulse-500"
                  />
                  {cat.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="mt-4 space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold text-ink-800">Related posts (on blog posts)</h2>
        <p className="text-xs text-ink-400">
          Shows other published posts from the same category below a blog post.
        </p>
        <Toggle
          checked={relatedPosts.enabled}
          onChange={(enabled) => setRelatedPosts((prev) => ({ ...prev, enabled }))}
          label="Show related posts below a blog post"
        />
        <div>
          <label className="text-sm font-medium text-ink-700">Number of posts to show</label>
          <input
            type="number"
            min={1}
            max={12}
            value={relatedPosts.count}
            onChange={(e) =>
              setRelatedPosts((prev) => ({
                ...prev,
                count: Math.min(12, Math.max(1, Number(e.target.value) || 1)),
              }))
            }
            className="mt-1 w-32 rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          />
        </div>
      </Card>

      <Button className="mt-6" size="sm" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
      {saved && <span className="ml-3 text-xs text-pulse-600">Saved</span>}
    </div>
  );
}
