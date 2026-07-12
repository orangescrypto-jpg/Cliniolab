import { getDb, generateId, nowIso } from '@/lib/db/client';
import type { Feedback, FeedbackCategory, FeedbackStatus } from '@/types';

interface FeedbackRow {
  id: string;
  user_id: string | null;
  category: string;
  message: string;
  page_url: string | null;
  status: string;
  created_at: string;
}

function mapFeedback(row: FeedbackRow): Feedback {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category as FeedbackCategory,
    message: row.message,
    pageUrl: row.page_url,
    status: row.status as FeedbackStatus,
    createdAt: row.created_at,
  };
}

export async function submitFeedback(input: {
  userId?: string;
  category: FeedbackCategory;
  message: string;
  pageUrl?: string;
}): Promise<Feedback> {
  const db = getDb();
  const id = generateId('feedback');
  const createdAt = nowIso();
  await db
    .prepare(
      "INSERT INTO feedback (id, user_id, category, message, page_url, status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)"
    )
    .bind(id, input.userId ?? null, input.category, input.message, input.pageUrl ?? null, createdAt)
    .run();
  return {
    id,
    userId: input.userId ?? null,
    category: input.category,
    message: input.message,
    pageUrl: input.pageUrl ?? null,
    status: 'open',
    createdAt,
  };
}

export async function listFeedback(): Promise<Feedback[]> {
  const db = getDb();
  const { results } = await db
    .prepare('SELECT * FROM feedback ORDER BY created_at DESC')
    .all<FeedbackRow>();
  return results.map(mapFeedback);
}

export async function updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<void> {
  const db = getDb();
  await db.prepare('UPDATE feedback SET status = ? WHERE id = ?').bind(status, id).run();
}
