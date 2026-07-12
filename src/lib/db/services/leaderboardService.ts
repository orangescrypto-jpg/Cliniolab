import { getDb } from '@/lib/db/client';
import type { LeaderboardEntry } from '@/types';

interface LeaderboardRow {
  user_id: string;
  display_name: string | null;
  total_score: number;
  quizzes_taken: number;
  avg_percentage: number;
}

function mapEntries(rows: LeaderboardRow[]): LeaderboardEntry[] {
  return rows.map((row, index) => ({
    userId: row.user_id,
    displayName: row.display_name ?? 'Anonymous',
    totalScore: row.total_score,
    quizzesTaken: row.quizzes_taken,
    averagePercentage: row.avg_percentage,
    rank: index + 1,
  }));
}

/** Site-wide top 10, counting only attempts flagged countsForLeaderboard. */
export async function getGeneralLeaderboard(limit = 16): Promise<LeaderboardEntry[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT
        a.user_id as user_id,
        u.display_name as display_name,
        SUM(a.score) as total_score,
        COUNT(*) as quizzes_taken,
        AVG(CAST(a.score AS REAL) / a.total_questions * 100) as avg_percentage
      FROM quiz_attempts a
      JOIN users u ON u.id = a.user_id
      WHERE a.counts_for_leaderboard = 1
      GROUP BY a.user_id
      ORDER BY total_score DESC
      LIMIT ?`
    )
    .bind(limit)
    .all<LeaderboardRow>();
  return mapEntries(results);
}

/** Top 10 for a specific category (joins through subcategory -> quiz). */
export async function getCategoryLeaderboard(
  categoryId: string,
  limit = 16
): Promise<LeaderboardEntry[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT
        a.user_id as user_id,
        u.display_name as display_name,
        SUM(a.score) as total_score,
        COUNT(*) as quizzes_taken,
        AVG(CAST(a.score AS REAL) / a.total_questions * 100) as avg_percentage
      FROM quiz_attempts a
      JOIN users u ON u.id = a.user_id
      JOIN quizzes q ON q.id = a.quiz_id
      JOIN subcategories s ON s.id = q.subcategory_id
      WHERE a.counts_for_leaderboard = 1 AND s.category_id = ?
      GROUP BY a.user_id
      ORDER BY total_score DESC
      LIMIT ?`
    )
    .bind(categoryId, limit)
    .all<LeaderboardRow>();
  return mapEntries(results);
}

/**
 * Top scorers for one specific quiz/exam - distinct from the general and
 * category leaderboards. Ranks by each user's best recorded percentage
 * on that specific quiz, not total score across all quizzes.
 */
export async function getQuizLeaderboard(quizId: string, limit = 16): Promise<LeaderboardEntry[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT
        a.user_id as user_id,
        u.display_name as display_name,
        MAX(a.score) as total_score,
        COUNT(*) as quizzes_taken,
        MAX(CAST(a.score AS REAL) / a.total_questions * 100) as avg_percentage
      FROM quiz_attempts a
      JOIN users u ON u.id = a.user_id
      WHERE a.quiz_id = ? AND a.counts_for_leaderboard = 1
      GROUP BY a.user_id
      ORDER BY avg_percentage DESC
      LIMIT ?`
    )
    .bind(quizId, limit)
    .all<LeaderboardRow>();
  return mapEntries(results);
}
