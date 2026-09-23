import { getDb, generateId, nowIso } from '@/lib/db/client';

/**
 * Records one completed Study Mode session (the user reached the
 * "Finish studying" summary screen). Mirrors recordFlashcardAttempt -
 * no score, retake policy, or anti-cheat concept here, since Study
 * Mode intentionally never touches quiz_attempts or the leaderboard.
 * Every finished session is its own row.
 */
export async function recordStudyAttempt(quizId: string, userId: string): Promise<void> {
  const db = getDb();
  await db
    .prepare('INSERT INTO study_attempts (id, quiz_id, user_id, completed_at) VALUES (?, ?, ?, ?)')
    .bind(generateId('studyattempt'), quizId, userId, nowIso())
    .run();
}

/** Count of completed Study Mode sessions for a quiz, for display alongside attemptCount. */
export async function getStudyAttemptCount(quizId: string): Promise<number> {
  const db = getDb();
  const row = await db
    .prepare('SELECT COUNT(*) as count FROM study_attempts WHERE quiz_id = ?')
    .bind(quizId)
    .first<{ count: number }>();
  return row?.count ?? 0;
}
