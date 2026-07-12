import { getDb, nowIso } from '@/lib/db/client';
import type { AppUser, UserDashboardStats, UserRole } from '@/types';

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  email_quiz_results: number;
  email_newsletter: number;
  current_streak_days: number;
  longest_streak_days: number;
  last_activity_date: string | null;
  creator_balance_kobo: number;
  payout_bank_code: string | null;
  payout_bank_name: string | null;
  payout_account_number: string | null;
  payout_account_name: string | null;
  created_at: string;
}

function mapUser(row: UserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role as UserRole,
    emailQuizResults: row.email_quiz_results === 1,
    emailNewsletter: row.email_newsletter === 1,
    currentStreakDays: row.current_streak_days,
    longestStreakDays: row.longest_streak_days,
    lastActivityDate: row.last_activity_date,
    creatorBalanceKobo: row.creator_balance_kobo,
    payoutBankCode: row.payout_bank_code,
    payoutBankName: row.payout_bank_name,
    payoutAccountNumber: row.payout_account_number,
    payoutAccountName: row.payout_account_name,
    createdAt: row.created_at,
  };
}

/**
 * Ensures a users row exists for a Supabase-authenticated user (upsert on
 * first login). This is what links Supabase Auth identities to D1 data.
 */
export async function ensureUserRecord(
  id: string,
  email: string,
  displayName?: string
): Promise<AppUser> {
  const db = getDb();
  const existing = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
  if (existing) return mapUser(existing);

  const createdAt = nowIso();
  await db
    .prepare(
      'INSERT INTO users (id, email, display_name, role, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, email, displayName ?? null, 'user', createdAt)
    .run();
  return {
    id,
    email,
    displayName: displayName ?? null,
    role: 'user',
    emailQuizResults: true,
    emailNewsletter: true,
    currentStreakDays: 0,
    longestStreakDays: 0,
    lastActivityDate: null,
    creatorBalanceKobo: 0,
    payoutBankCode: null,
    payoutBankName: null,
    payoutAccountNumber: null,
    payoutAccountName: null,
    createdAt,
  };
}

export async function getUserById(id: string): Promise<AppUser | null> {
  const db = getDb();
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
  return row ? mapUser(row) : null;
}

export async function setUserRole(id: string, role: UserRole): Promise<void> {
  const db = getDb();
  await db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, id).run();
}

export async function adminListUsers(): Promise<AppUser[]> {
  const db = getDb();
  const { results } = await db.prepare('SELECT * FROM users ORDER BY created_at DESC').all<UserRow>();
  return results.map(mapUser);
}

/**
 * Saves a creator's verified bank details for future payouts. Under
 * Model B there's no subaccount to register with the provider up front —
 * these details are only used later, at the moment admin actions a
 * payout request via the Flutterwave Transfers API.
 */
export async function savePayoutDetails(
  userId: string,
  details: {
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  }
): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      `UPDATE users SET
        payout_bank_code = ?,
        payout_bank_name = ?,
        payout_account_number = ?,
        payout_account_name = ?
       WHERE id = ?`
    )
    .bind(details.bankCode, details.bankName, details.accountNumber, details.accountName, userId)
    .run();
}

/** Adds (or subtracts, with a negative delta) from a creator's withdrawable balance. */
export async function adjustCreatorBalance(userId: string, deltaKobo: number): Promise<void> {
  const db = getDb();
  await db
    .prepare('UPDATE users SET creator_balance_kobo = creator_balance_kobo + ? WHERE id = ?')
    .bind(deltaKobo, userId)
    .run();
}

export async function updateEmailPreferences(
  userId: string,
  prefs: { emailQuizResults?: boolean; emailNewsletter?: boolean }
): Promise<void> {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (prefs.emailQuizResults !== undefined) {
    fields.push('email_quiz_results = ?');
    values.push(prefs.emailQuizResults ? 1 : 0);
  }
  if (prefs.emailNewsletter !== undefined) {
    fields.push('email_newsletter = ?');
    values.push(prefs.emailNewsletter ? 1 : 0);
  }
  if (fields.length === 0) return;
  values.push(userId);
  await db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
}

/**
 * Updates a user's streak based on today's activity. Call this once per
 * quiz/exam attempt. Logic:
 * - If last activity was yesterday, increment the streak.
 * - If last activity was today already, no change (already counted).
 * - If last activity was earlier than yesterday (or never), reset to 1.
 */
export async function recordActivityForStreak(userId: string): Promise<void> {
  const db = getDb();
  const user = await db
    .prepare('SELECT current_streak_days, longest_streak_days, last_activity_date FROM users WHERE id = ?')
    .bind(userId)
    .first<{ current_streak_days: number; longest_streak_days: number; last_activity_date: string | null }>();
  if (!user) return;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  if (user.last_activity_date === today) return; // already recorded today

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newStreak = user.last_activity_date === yesterday ? user.current_streak_days + 1 : 1;
  const newLongest = Math.max(newStreak, user.longest_streak_days);

  await db
    .prepare(
      'UPDATE users SET current_streak_days = ?, longest_streak_days = ?, last_activity_date = ? WHERE id = ?'
    )
    .bind(newStreak, newLongest, today, userId)
    .run();
}

/** Users who haven't been active in exactly N days (for the inactivity nudge cron). */
export async function listUsersInactiveForDays(days: number): Promise<AppUser[]> {
  const db = getDb();
  const targetDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { results } = await db
    .prepare('SELECT * FROM users WHERE last_activity_date = ?')
    .bind(targetDate)
    .all<UserRow>();
  return results.map(mapUser);
}

export async function getUserDashboardStats(userId: string): Promise<UserDashboardStats> {
  const db = getDb();

  const summary = await db
    .prepare(
      `SELECT
        COUNT(*) as total_attempts,
        AVG(CAST(score AS REAL) / total_questions * 100) as avg_percentage,
        MAX(CAST(score AS REAL) / total_questions * 100) as best_percentage
      FROM quiz_attempts WHERE user_id = ?`
    )
    .bind(userId)
    .first<{ total_attempts: number; avg_percentage: number | null; best_percentage: number | null }>();

  const quizzesCreated = await db
    .prepare('SELECT COUNT(*) as count FROM quizzes WHERE creator_id = ?')
    .bind(userId)
    .first<{ count: number }>();

  const certificatesEarned = await db
    .prepare('SELECT COUNT(*) as count FROM certificates WHERE user_id = ?')
    .bind(userId)
    .first<{ count: number }>();

  const { results: history } = await db
    .prepare(
      `SELECT a.completed_at as date,
              (CAST(a.score AS REAL) / a.total_questions * 100) as percentage,
              q.title as quiz_title
       FROM quiz_attempts a
       JOIN quizzes q ON q.id = a.quiz_id
       WHERE a.user_id = ? AND a.completed_at IS NOT NULL
       ORDER BY a.completed_at ASC`
    )
    .bind(userId)
    .all<{ date: string; percentage: number; quiz_title: string }>();

  return {
    totalAttempts: summary?.total_attempts ?? 0,
    averagePercentage: summary?.avg_percentage ?? 0,
    bestPercentage: summary?.best_percentage ?? 0,
    quizzesCreated: quizzesCreated?.count ?? 0,
    certificatesEarned: certificatesEarned?.count ?? 0,
    scoreHistory: history.map((h) => ({ date: h.date, percentage: h.percentage, quizTitle: h.quiz_title })),
  };
}
