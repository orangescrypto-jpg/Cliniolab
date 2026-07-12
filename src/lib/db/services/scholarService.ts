import { getDb, generateId, nowIso } from '@/lib/db/client';
import type { ScholarOfTheDay } from '@/types';

interface ScholarRow {
  id: string;
  student_user_id: string | null;
  name: string;
  photo_url: string | null;
  bio: string | null;
  achievement: string | null;
  quote: string | null;
  is_active: number;
  created_by: string;
  created_at: string;
}

function mapScholar(row: ScholarRow): ScholarOfTheDay {
  return {
    id: row.id,
    studentUserId: row.student_user_id,
    name: row.name,
    photoUrl: row.photo_url,
    bio: row.bio,
    achievement: row.achievement,
    quote: row.quote,
    isActive: row.is_active === 1,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/** The current homepage spotlight — most recently created active entry. */
export async function getActiveScholar(): Promise<ScholarOfTheDay | null> {
  const db = getDb();
  const row = await db
    .prepare('SELECT * FROM scholars_of_the_day WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1')
    .first<ScholarRow>();
  return row ? mapScholar(row) : null;
}

export async function getScholarById(id: string): Promise<ScholarOfTheDay | null> {
  const db = getDb();
  const row = await db.prepare('SELECT * FROM scholars_of_the_day WHERE id = ?').bind(id).first<ScholarRow>();
  return row ? mapScholar(row) : null;
}

/** Full history, for the admin list and a public "past scholars" archive page. */
export async function listScholars(): Promise<ScholarOfTheDay[]> {
  const db = getDb();
  const { results } = await db
    .prepare('SELECT * FROM scholars_of_the_day ORDER BY created_at DESC')
    .all<ScholarRow>();
  return results.map(mapScholar);
}

export interface ScholarInput {
  studentUserId?: string;
  name: string;
  photoUrl?: string;
  bio?: string;
  achievement?: string;
  quote?: string;
}

/**
 * Creates a new scholar entry and makes it the active one. Only one
 * scholar should be "active" (shown on the homepage) at a time, so this
 * deactivates any previously active entry rather than requiring the admin
 * to remember to do that themselves.
 */
export async function createScholar(createdBy: string, input: ScholarInput): Promise<ScholarOfTheDay> {
  const db = getDb();
  const id = generateId('scholar');
  const now = nowIso();

  await db.batch([
    db.prepare('UPDATE scholars_of_the_day SET is_active = 0 WHERE is_active = 1'),
    db
      .prepare(
        `INSERT INTO scholars_of_the_day
          (id, student_user_id, name, photo_url, bio, achievement, quote, is_active, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .bind(
        id,
        input.studentUserId ?? null,
        input.name.trim(),
        input.photoUrl?.trim() || null,
        input.bio?.trim() || null,
        input.achievement?.trim() || null,
        input.quote?.trim() || null,
        createdBy,
        now
      ),
  ]);

  return {
    id,
    studentUserId: input.studentUserId ?? null,
    name: input.name.trim(),
    photoUrl: input.photoUrl?.trim() || null,
    bio: input.bio?.trim() || null,
    achievement: input.achievement?.trim() || null,
    quote: input.quote?.trim() || null,
    isActive: true,
    createdBy,
    createdAt: now,
  };
}

export async function updateScholar(id: string, input: ScholarInput): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      `UPDATE scholars_of_the_day SET
        student_user_id = ?, name = ?, photo_url = ?, bio = ?, achievement = ?, quote = ?
       WHERE id = ?`
    )
    .bind(
      input.studentUserId ?? null,
      input.name.trim(),
      input.photoUrl?.trim() || null,
      input.bio?.trim() || null,
      input.achievement?.trim() || null,
      input.quote?.trim() || null,
      id
    )
    .run();
}

/** Makes this entry the active homepage spotlight, deactivating whichever one currently is. */
export async function setActiveScholar(id: string): Promise<void> {
  const db = getDb();
  await db.batch([
    db.prepare('UPDATE scholars_of_the_day SET is_active = 0 WHERE is_active = 1'),
    db.prepare('UPDATE scholars_of_the_day SET is_active = 1 WHERE id = ?').bind(id),
  ]);
}

export async function deleteScholar(id: string): Promise<void> {
  const db = getDb();
  await db.prepare('DELETE FROM scholars_of_the_day WHERE id = ?').bind(id).run();
}
