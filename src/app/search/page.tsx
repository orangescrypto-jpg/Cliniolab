'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import type { SearchResults } from '@/lib/db/services/searchService';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const [results, setResults] = useState<SearchResults | null>(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!query) return;
    fetch(`/api/search?q=${encodeURIComponent(query)}`)
      .then((res) => res.json())
      .then((data) => {
        setEnabled(data.enabled);
        setResults(data.results);
      });
  }, [query]);

  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="text-sm text-ink-400">Search is currently unavailable.</p>
      </div>
    );
  }

  const hasResults =
    results && (results.quizzes.length > 0 || results.posts.length > 0 || results.resources.length > 0);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-2xl font-semibold text-ink-800">
        Search results for &ldquo;{query}&rdquo;
      </h1>

      {!hasResults && results && (
        <p className="mt-6 text-sm text-ink-400">No results found.</p>
      )}

      {results && results.quizzes.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-pulse-600">Quizzes</h2>
          <div className="mt-3 space-y-2">
            {results.quizzes.map((q) => (
              <Link key={q.id} href={`/quizzes/${q.id}`}>
                <Card className="p-4 transition-shadow hover:shadow-md">
                  <p className="text-sm font-medium text-ink-800">{q.title}</p>
                  {q.description && <p className="mt-1 text-xs text-ink-400">{q.description}</p>}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {results && results.posts.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-pulse-600">Blog</h2>
          <div className="mt-3 space-y-2">
            {results.posts.map((p) => (
              <Link key={p.id} href={`/blog/${p.slug}`}>
                <Card className="p-4 transition-shadow hover:shadow-md">
                  <p className="text-sm font-medium text-ink-800">{p.title}</p>
                  {p.category && <p className="mt-1 text-xs text-ink-400">{p.category}</p>}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {results && results.resources.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-pulse-600">Resources</h2>
          <div className="mt-3 space-y-2">
            {results.resources.map((r) => (
              <Link key={r.id} href="/resources">
                <Card className="p-4 transition-shadow hover:shadow-md">
                  <p className="text-sm font-medium text-ink-800">{r.title}</p>
                  {r.description && <p className="mt-1 text-xs text-ink-400">{r.description}</p>}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
