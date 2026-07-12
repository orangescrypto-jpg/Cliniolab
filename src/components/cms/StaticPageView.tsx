'use client';

import { useEffect, useState } from 'react';
import type { StaticPage } from '@/types';

export function StaticPageView({ pageId, fallbackTitle }: { pageId: string; fallbackTitle: string }) {
  const [page, setPage] = useState<StaticPage | null>(null);

  useEffect(() => {
    fetch(`/api/pages/${pageId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setPage(data.page));
  }, [pageId]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">
        {page?.title ?? fallbackTitle}
      </h1>
      <div className="mt-6 whitespace-pre-wrap text-ink-700">
        {page?.content ?? 'This page has not been set up yet.'}
      </div>
    </div>
  );
}
