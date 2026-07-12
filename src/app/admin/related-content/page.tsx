'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import type { RelatedQuizzesSetting } from '@/types';

const DEFAULT_SETTING: RelatedQuizzesSetting = { enabled: true, count: 6 };

export default function AdminRelatedContentPage() {
  const [quizPage, setQuizPage] = useState<RelatedQuizzesSetting>(DEFAULT_SETTING);
  const [blogPage, setBlogPage] = useState<RelatedQuizzesSetting>(DEFAULT_SETTING);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/related-quizzes')
      .then((res) => res.json())
      .then((data) => {
        if (data.quizPage) setQuizPage(data.quizPage);
        if (data.blogPage) setBlogPage(data.blogPage);
      });
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/related-quizzes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizPage, blogPage }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Related content</h1>
      <p className="mt-2 text-ink-500">
        Controls the &ldquo;related quizzes&rdquo; grid shown below quizzes and blog posts. Displayed
        as a 2-column grid.
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
      </Card>

      <Button className="mt-6" size="sm" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
      {saved && <span className="ml-3 text-xs text-pulse-600">Saved</span>}
    </div>
  );
}
