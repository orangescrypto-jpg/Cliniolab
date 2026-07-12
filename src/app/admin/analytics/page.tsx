'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import type { AdminAnalytics } from '@/lib/db/services/analyticsService';

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then((res) => res.json())
      .then((data) => setAnalytics(data.analytics));
  }, []);

  if (!analytics) return null;

  const maxSignup = Math.max(1, ...analytics.signupTrend.map((s) => s.count));

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Analytics</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card className="p-5 text-center">
          <p className="font-mono text-2xl font-semibold text-ink-800">{analytics.totalUsers}</p>
          <p className="mt-1 text-xs text-ink-400">Total users</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="font-mono text-2xl font-semibold text-ink-800">{analytics.totalQuizzes}</p>
          <p className="mt-1 text-xs text-ink-400">Total quizzes</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="font-mono text-2xl font-semibold text-ink-800">{analytics.totalAttemptsAllTime}</p>
          <p className="mt-1 text-xs text-ink-400">Attempts all time</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="font-mono text-2xl font-semibold text-pulse-600">{analytics.attemptsToday}</p>
          <p className="mt-1 text-xs text-ink-400">Attempts today</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="font-mono text-2xl font-semibold text-pulse-600">{analytics.attemptsThisWeek}</p>
          <p className="mt-1 text-xs text-ink-400">Attempts this week</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="font-mono text-2xl font-semibold text-flag-500">{analytics.signupsThisWeek}</p>
          <p className="mt-1 text-xs text-ink-400">Signups this week</p>
        </Card>
      </div>

      <Card className="mt-8 p-6">
        <h2 className="font-display text-lg font-semibold text-ink-800">Signups (last 30 days)</h2>
        <div className="mt-4 flex items-end gap-1" style={{ height: 100 }}>
          {analytics.signupTrend.map((s) => (
            <div
              key={s.date}
              title={`${s.date}: ${s.count}`}
              className="flex-1 rounded-t bg-pulse-400"
              style={{ height: `${Math.max(4, (s.count / maxSignup) * 100)}%` }}
            />
          ))}
          {analytics.signupTrend.length === 0 && (
            <p className="text-sm text-ink-400">No signups yet.</p>
          )}
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="font-display text-lg font-semibold text-ink-800">Most attempted quizzes</h2>
        <div className="mt-4 space-y-2">
          {analytics.topQuizzes.map((q) => (
            <div key={q.id} className="flex items-center justify-between text-sm">
              <span className="text-ink-700">{q.title}</span>
              <span className="font-mono text-ink-400">{q.attemptCount} attempts</span>
            </div>
          ))}
          {analytics.topQuizzes.length === 0 && (
            <p className="text-sm text-ink-400">No quizzes yet.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
