'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { BookmarkKind } from '@/types';

interface BookmarkButtonProps {
  kind: BookmarkKind;
  targetId: string;
  /** Pass true if the caller already knows the bookmarked state (e.g. from a bulk list fetch), to skip this component's own lookup call. */
  initialBookmarked?: boolean;
  className?: string;
}

export function BookmarkButton({ kind, targetId, initialBookmarked, className = '' }: BookmarkButtonProps) {
  const { user } = useAuth();
  const [bookmarked, setBookmarked] = useState(initialBookmarked ?? false);
  const [loading, setLoading] = useState(false);

  // Only look up state ourselves if the caller didn't already provide it
  // (e.g. a lone bookmark button on a detail page, vs. a grid of cards
  // that already fetched bookmark state in bulk for efficiency).
  useEffect(() => {
    if (initialBookmarked !== undefined || !user) return;
    fetch(`/api/bookmarks?kind=${kind}`)
      .then((res) => res.json())
      .then((data) => {
        const isBookmarked = (data.bookmarks ?? []).some((b: { targetId: string }) => b.targetId === targetId);
        setBookmarked(isBookmarked);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, kind, targetId]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); // cards are often wrapped in a Link — don't navigate when tapping the bookmark icon
    e.stopPropagation();
    if (!user || loading) return;
    setLoading(true);
    const previous = bookmarked;
    setBookmarked(!previous); // optimistic
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, targetId }),
      });
      if (!res.ok) setBookmarked(previous);
    } catch {
      setBookmarked(previous);
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-label={bookmarked ? 'Remove bookmark' : 'Save for later'}
      title={bookmarked ? 'Remove bookmark' : 'Save for later'}
      className={`text-lg leading-none transition-colors disabled:opacity-50 ${
        bookmarked ? 'text-pulse-600' : 'text-ink-300 hover:text-pulse-500'
      } ${className}`}
    >
      {bookmarked ? '🔖' : '📑'}
    </button>
  );
}
