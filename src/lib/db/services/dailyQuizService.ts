import { getDb, nowIso } from '@/lib/db/client';
import * as quizService from '@/lib/db/services/quizService';
import type { QuizWithStats } from '@/types';

/**
 * Single source of truth for "which quiz is today's daily quiz".
 * The homepage banner, /api/daily-quiz and the push cron all call
 * getTodaysDailyQuiz(), so they can never disagree.
 *
 * Behaviour:
 *  - "Today" is the Africa/Lagos calendar day (UTC+1, no DST), not UTC.
 *  - An admin-scheduled quiz for today wins.
 *  - Otherwise the first call of the day picks a quiz, and that pick is
 *    written to daily_quiz_history so it stays fixed all day.
 *  - Auto picks avoid quizzes served in the last N days (admin setting).
 *  - Admin-configurable values live in site_settings, not in code.
 */

export interface DailyQuizSettings {
  poolSize: number; // how many latest public quizzes are eligible
  noRepeatDays: number; // don't re-serve a quiz used within this many days
  skipCompletedForPush: boolean; // push only users who haven't taken it yet
}

export const DEFAULT_DAILY_QUIZ_SETTINGS: DailyQuizSettings = {
  poolSize: 100,
  noRepeatDays: 14,
  skipCompletedForPush: true,
};

const SETTINGS_KEY = 'daily_quiz_settings';
const LAGOS_OFFSET_MS = 60 * 60 * 1000; // UTC+1, Nigeria has no DST

interface SettingRow {
  value: string;
}

/** YYYY-MM-DD for the current day in Africa/Lagos. */
export function getLagosDateString(now: Date = new Date()): string {
  return new Date(now.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalizeSettings(raw: Partial<DailyQuizSettings> | null): DailyQuizSettings {
  const d = DEFAULT_DAILY_QUIZ_SETTINGS;
  return {
    poolSize: clamp(Number(raw?.poolSize ?? d.poolSize), 1, 500),
    noRepeatDays: clamp(Number(raw?.noRepeatDays ?? d.noRepeatDays), 0, 365),
    skipCompletedForPush:
      typeof raw?.skipCompletedForPush === 'boolean' ? raw.skipCompletedForPush : d.skipCompletedForPush,
  };
}

export async function getSettings(): Promise<DailyQuizSettings> {
  const db = getDb();
  const row = await db
    .prepare('SELECT value FROM site_settings WHERE key = ?')
    .bind(SETTINGS_KEY)
    .first<SettingRow>();
  if (!row) return DEFAULT_DAILY_QUIZ_SETTINGS;
  try {
    return normalizeSettings(JSON.parse(row.value));
  } catch {
    return DEFAULT_DAILY_QUIZ_SETTINGS;
  }
}

export async function setSettings(input: Partial<DailyQuizSettings>): Promise<DailyQuizSettings> {
  const next = normalizeSettings({ ...(await getSettings()), ...input });
  const db = getDb();
  await db
    .prepare(
      `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind(SETTINGS_KEY, JSON.stringify(next), nowIso())
    .run();
  return next;
}

/** Returns the quiz only if it is still public + published, else null. */
async function getServableQuiz(quizId: string): Promise<QuizWithStats | null> {
  const pool = await quizService.listLatestPublicQuizzes(500);
  return pool.find((q) => q.id === quizId) ?? null;
}

async function recentlyServedQuizIds(beforeDate: string, days: number): Promise<Set<string>> {
  if (days <= 0) return new Set();
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT quiz_id FROM daily_quiz_history
       WHERE date < ? ORDER BY date DESC LIMIT ?`
    )
    .bind(beforeDate, days)
    .all<{ quiz_id: string }>();
  return new Set(results.map((r) => r.quiz_id));
}

function hashDateToIndex(dateStr: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  return modulo > 0 ? hash % modulo : 0;
}

/**
 * Today's daily quiz, or null if nothing is eligible.
 * Idempotent: repeated calls on the same Lagos day return the same quiz.
 */
export async function getTodaysDailyQuiz(): Promise<QuizWithStats | null> {
  const db = getDb();
  const today = getLagosDateString();

  // 1. Already decided for today? Serve it as long as it is still valid.
  const existing = await db
    .prepare('SELECT quiz_id FROM daily_quiz_history WHERE date = ?')
    .bind(today)
    .first<{ quiz_id: string }>();
  if (existing) {
    const quiz = await getServableQuiz(existing.quiz_id);
    if (quiz) return quiz;
    // The chosen quiz was unpublished/deleted mid-day: fall through and re-pick.
    await db.prepare('DELETE FROM daily_quiz_history WHERE date = ?').bind(today).run();
  }

  // 2. Admin-scheduled quiz for today.
  const scheduled = await db
    .prepare('SELECT quiz_id FROM daily_quiz_schedule WHERE date = ?')
    .bind(today)
    .first<{ quiz_id: string }>();
  if (scheduled) {
    const quiz = await getServableQuiz(scheduled.quiz_id);
    if (quiz) {
      await saveHistory(today, quiz.id, 'scheduled');
      return quiz;
    }
  }

  // 3. Auto-pick from the pool, skipping recently used quizzes.
  const settings = await getSettings();
  const pool = await quizService.listLatestPublicQuizzes(settings.poolSize);
  if (pool.length === 0) return null;

  const recent = await recentlyServedQuizIds(today, settings.noRepeatDays);
  // Stable order (by id) so the hash pick does not shift when quizzes are edited.
  const stable = [...pool].sort((a, b) => a.id.localeCompare(b.id));
  const fresh = stable.filter((q) => !recent.has(q.id));
  const candidates = fresh.length > 0 ? fresh : stable; // pool smaller than window: allow repeats

  const quiz = candidates[hashDateToIndex(today, candidates.length)];
  await saveHistory(today, quiz.id, 'auto');
  return quiz;
}

async function saveHistory(date: string, quizId: string, source: 'auto' | 'scheduled'): Promise<void> {
  const db = getDb();
  // INSERT OR IGNORE: if two requests race on the first call of the day,
  // the first write wins and both end up reading the same row.
  await db
    .prepare('INSERT OR IGNORE INTO daily_quiz_history (date, quiz_id, source) VALUES (?, ?, ?)')
    .bind(date, quizId, source)
    .run();
}

/** True if the user has already attempted today's quiz. */
export async function hasUserCompletedQuiz(userId: string, quizId: string): Promise<boolean> {
  const db = getDb();
  const row = await db
    .prepare('SELECT 1 AS x FROM quiz_attempts WHERE user_id = ? AND quiz_id = ? LIMIT 1')
    .bind(userId, quizId)
    .first<{ x: number }>();
  return !!row;
}

// ---------- Admin schedule management ----------

export interface ScheduledDailyQuiz {
  date: string;
  quizId: string;
  quizTitle: string | null;
}

export async function listSchedule(fromDate = getLagosDateString()): Promise<ScheduledDailyQuiz[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT s.date, s.quiz_id, q.title
       FROM daily_quiz_schedule s
       LEFT JOIN quizzes q ON q.id = s.quiz_id
       WHERE s.date >= ? ORDER BY s.date ASC LIMIT 60`
    )
    .bind(fromDate)
    .all<{ date: string; quiz_id: string; title: string | null }>();
  return results.map((r) => ({ date: r.date, quizId: r.quiz_id, quizTitle: r.title }));
}

export async function setScheduled(date: string, quizId: string): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      `INSERT INTO daily_quiz_schedule (date, quiz_id) VALUES (?, ?)
       ON CONFLICT(date) DO UPDATE SET quiz_id = excluded.quiz_id`
    )
    .bind(date, quizId)
    .run();
  // If the schedule is set for today, clear today's frozen pick so the
  // scheduled quiz takes effect immediately.
  if (date === getLagosDateString()) {
    await db.prepare('DELETE FROM daily_quiz_history WHERE date = ?').bind(date).run();
  }
}

export async function removeScheduled(date: string): Promise<void> {
  const db = getDb();
  await db.prepare('DELETE FROM daily_quiz_schedule WHERE date = ?').bind(date).run();
  if (date === getLagosDateString()) {
    await db
      .prepare("DELETE FROM daily_quiz_history WHERE date = ? AND source = 'scheduled'")
      .bind(date)
      .run();
  }
}

export async function listRecentHistory(limit = 14): Promise<ScheduledDailyQuiz[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT h.date, h.quiz_id, q.title
       FROM daily_quiz_history h
       LEFT JOIN quizzes q ON q.id = h.quiz_id
       ORDER BY h.date DESC LIMIT ?`
    )
    .bind(limit)
    .all<{ date: string; quiz_id: string; title: string | null }>();
  return results.map((r) => ({ date: r.date, quizId: r.quiz_id, quizTitle: r.title }));
}
