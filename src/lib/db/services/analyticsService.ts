import { getDb } from '@/lib/db/client';

export interface AdminAnalytics {
  totalUsers: number;
  totalQuizzes: number;
  totalAttemptsAllTime: number;
  attemptsToday: number;
  attemptsThisWeek: number;
  signupsThisWeek: number;
  topQuizzes: { id: string; title: string; attemptCount: number }[];
  signupTrend: { date: string; count: number }[];
}

export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  const db = getDb();

  const totalUsers = await db
    .prepare('SELECT COUNT(*) as count FROM users')
    .first<{ count: number }>();

  const totalQuizzes = await db
    .prepare('SELECT COUNT(*) as count FROM quizzes')
    .first<{ count: number }>();

  const totalAttempts = await db
    .prepare('SELECT COUNT(*) as count FROM quiz_attempts')
    .first<{ count: number }>();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const attemptsToday = await db
    .prepare('SELECT COUNT(*) as count FROM quiz_attempts WHERE started_at >= ?')
    .bind(todayStart.toISOString())
    .first<{ count: number }>();

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const attemptsThisWeek = await db
    .prepare('SELECT COUNT(*) as count FROM quiz_attempts WHERE started_at >= ?')
    .bind(weekAgo)
    .first<{ count: number }>();

  const signupsThisWeek = await db
    .prepare('SELECT COUNT(*) as count FROM users WHERE created_at >= ?')
    .bind(weekAgo)
    .first<{ count: number }>();

  const { results: topQuizzes } = await db
    .prepare(
      `SELECT q.id as id, q.title as title, COUNT(a.id) as attempt_count
       FROM quizzes q
       LEFT JOIN quiz_attempts a ON a.quiz_id = q.id
       GROUP BY q.id
       ORDER BY attempt_count DESC
       LIMIT 5`
    )
    .all<{ id: string; title: string; attempt_count: number }>();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { results: signups } = await db
    .prepare(
      `SELECT substr(created_at, 1, 10) as date, COUNT(*) as count
       FROM users
       WHERE created_at >= ?
       GROUP BY date
       ORDER BY date ASC`
    )
    .bind(thirtyDaysAgo)
    .all<{ date: string; count: number }>();

  return {
    totalUsers: totalUsers?.count ?? 0,
    totalQuizzes: totalQuizzes?.count ?? 0,
    totalAttemptsAllTime: totalAttempts?.count ?? 0,
    attemptsToday: attemptsToday?.count ?? 0,
    attemptsThisWeek: attemptsThisWeek?.count ?? 0,
    signupsThisWeek: signupsThisWeek?.count ?? 0,
    topQuizzes: topQuizzes.map((q) => ({ id: q.id, title: q.title, attemptCount: q.attempt_count })),
    signupTrend: signups.map((s) => ({ date: s.date, count: s.count })),
  };
}
