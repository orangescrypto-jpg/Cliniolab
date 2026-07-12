import { getDb, generateId, nowIso } from '@/lib/db/client';

export type EmailType =
  | 'welcome'
  | 'leaderboard_recognition'
  | 'newsletter'
  | 'quiz_result'
  | 'comment_reply'
  | 'inactivity_nudge'
  | 'password_reset'
  | 'certificate_issued';

export async function logEmailSent(
  userId: string | null,
  emailType: EmailType,
  referenceId?: string
): Promise<void> {
  const db = getDb();
  await db
    .prepare('INSERT INTO email_log (id, user_id, email_type, reference_id, sent_at) VALUES (?, ?, ?, ?, ?)')
    .bind(generateId('email'), userId, emailType, referenceId ?? null, nowIso())
    .run();
}

/** Checks whether a one-time email (e.g. welcome) has already been sent to this user. */
export async function hasEmailBeenSent(
  userId: string,
  emailType: EmailType,
  referenceId?: string
): Promise<boolean> {
  const db = getDb();
  const row = referenceId
    ? await db
        .prepare('SELECT id FROM email_log WHERE user_id = ? AND email_type = ? AND reference_id = ?')
        .bind(userId, emailType, referenceId)
        .first<{ id: string }>()
    : await db
        .prepare('SELECT id FROM email_log WHERE user_id = ? AND email_type = ?')
        .bind(userId, emailType)
        .first<{ id: string }>();
  return !!row;
}
