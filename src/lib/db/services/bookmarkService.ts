import { getDb, generateId, nowIso } from '@/lib/db/client';
import type { Bookmark, BookmarkKind } from '@/types';

interface BookmarkRow {
  id: string;
  user_id: string;
  kind: string;
  target_id: string;
  created_at: string;
}

function mapBookmark(row: BookmarkRow): Bookmark {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind as BookmarkKind,
    targetId: row.target_id,
    createdAt: row.created_at,
  };
}

/** Toggles a bookmark on/off, mirroring the comment-like toggle pattern. */
export async function toggleBookmark(
  userId: string,
  kind: BookmarkKind,
  targetId: string
): Promise<{ bookmarked: boolean }> {
  const db = getDb();
  const existing = await db
    .prepare('SELECT id FROM bookmarks WHERE user_id = ? AND kind = ? AND target_id = ?')
    .bind(userId, kind, targetId)
    .first<{ id: string }>();

  if (existing) {
    await db.prepare('DELETE FROM bookmarks WHERE id = ?').bind(existing.id).run();
    return { bookmarked: false };
  }

  await db
    .prepare('INSERT INTO bookmarks (id, user_id, kind, target_id, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(generateId('bookmark'), userId, kind, targetId, nowIso())
    .run();
  return { bookmarked: true };
}

export async function listBookmarksForUser(userId: string, kind?: BookmarkKind): Promise<Bookmark[]> {
  const db = getDb();
  const { results } = kind
    ? await db
        .prepare('SELECT * FROM bookmarks WHERE user_id = ? AND kind = ? ORDER BY created_at DESC')
        .bind(userId, kind)
        .all<BookmarkRow>()
    : await db
        .prepare('SELECT * FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC')
        .bind(userId)
        .all<BookmarkRow>();
  return results.map(mapBookmark);
}

/** Returns just the set of target IDs a user has bookmarked for a given kind — cheap check for card UI. */
export async function getBookmarkedIds(userId: string, kind: BookmarkKind): Promise<Set<string>> {
  const db = getDb();
  const { results } = await db
    .prepare('SELECT target_id FROM bookmarks WHERE user_id = ? AND kind = ?')
    .bind(userId, kind)
    .all<{ target_id: string }>();
  return new Set(results.map((r) => r.target_id));
}
