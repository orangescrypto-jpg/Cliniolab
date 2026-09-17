import { getDb, generateId, nowIso } from '@/lib/db/client';

/**
 * Records one completed run through a flashcard set (the user reached
 * the end of the deck). Unlike quiz_attempts there's no score, retake
 * policy, or anti-cheat concept here - every finished session is its
 * own row, which is what the "X attempts" stat on the flashcard set
 * card counts.
 */
export async function recordFlashcardAttempt(setId: string, userId: string): Promise<void> {
  const db = getDb();
  await db
    .prepare('INSERT INTO flashcard_attempts (id, set_id, user_id, completed_at) VALUES (?, ?, ?, ?)')
    .bind(generateId('fcattempt'), setId, userId, nowIso())
    .run();
}
