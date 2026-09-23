'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';

interface CreatorSummary {
  id: string;
  displayName: string | null;
  bio: string | null;
  avatarPath: string | null;
}

/**
 * Compact "by this creator" teaser shown on the quiz detail page, below
 * the leaderboard and above related quizzes — links through to the full
 * public profile (/creator/[userId]) where all of this creator's public
 * quizzes and their total reach are shown. Self-fetches via
 * /api/creators/[userId] rather than requiring the parent to pass
 * profile data down, since QuizDetailClient already has enough props.
 */
export function CreatorProfileCard({ creatorId }: { creatorId: string }) {
  const [data, setData] = useState<{ profile: CreatorSummary; stats: { quizCount: number; totalAttempts: number } } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/creators/${creatorId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  if (!data) return null;
  const { profile, stats } = data;
  const name = profile.displayName ?? 'Cliniolab creator';

  return (
    <Link href={`/creator/${profile.id}`}>
      <Card className="flex items-center gap-4 p-5 transition-shadow hover:shadow-md">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-ink-100">
          {profile.avatarPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarPath} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-ink-400">
              {name[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-ink-400">Quiz by</p>
          <h3 className="font-display text-base font-semibold text-ink-800">{name}</h3>
          {profile.bio && <p className="mt-0.5 line-clamp-1 text-sm text-ink-500">{profile.bio}</p>}
          <p className="mt-1 text-xs text-ink-400">
            {stats.quizCount} {stats.quizCount === 1 ? 'quiz' : 'quizzes'} · {stats.totalAttempts} students reached
          </p>
        </div>
        <span className="shrink-0 text-sm font-medium text-pulse-600">View profile →</span>
      </Card>
    </Link>
  );
}
