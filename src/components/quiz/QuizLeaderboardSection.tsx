'use client';

import { useEffect, useState } from 'react';
import { LeaderboardList } from '@/components/quiz/LeaderboardList';
import type { LeaderboardEntry } from '@/types';

export function QuizLeaderboardSection({ quizId }: { quizId: string }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    fetch(`/api/leaderboard/quiz/${quizId}`)
      .then((res) => res.json())
      .then((data) => {
        setEnabled(data.enabled);
        setEntries(data.entries ?? []);
      });
  }, [quizId]);

  if (!enabled || entries.length === 0) return null;

  return (
    <div className="mt-12">
      <LeaderboardList entries={entries} title="This Quiz's Leaderboard" />
    </div>
  );
}
