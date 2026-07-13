import { getDb, generateId, nowIso } from '@/lib/db/client';
import type { Comment } from '@/types';

interface CommentRow {
  id: string;
  quiz_id: string | null;
  blog_post_id: string | null;
  user_id: string;
  display_name: string | null;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
  like_count: number;
  liked_by_me: number;
}

function mapComment(row: CommentRow): Comment {
  return {
    id: row.id,
    quizId: row.quiz_id,
    blogPostId: row.blog_post_id,
    userId: row.user_id,
    authorName: row.display_name ?? 'Anonymous',
    parentCommentId: row.parent_comment_id,
    body: row.body,
    createdAt: row.created_at,
    likeCount: row.like_count,
    likedByMe: !!row.liked_by_me,
  };
}

/** Nests a flat list of comment rows into a full reply tree of arbitrary depth. */
function nest(all: Comment[]): Comment[] {
  const byId = new Map(all.map((c) => [c.id, c]));
  const topLevel: Comment[] = [];

  for (const comment of all) {
    if (comment.parentCommentId) {
      const parent = byId.get(comment.parentCommentId);
      if (parent) {
        if (!parent.replies) parent.replies = [];
        parent.replies.push(comment);
        continue;
      }
    }
    topLevel.push(comment);
  }

  return topLevel;
}

type SubjectColumn = 'quiz_id' | 'blog_post_id';

/**
 * Shared implementation for fetching comments against either a quiz or a
 * blog post. `column` is always a fixed identifier from this file (never
 * user input), so it's safe to interpolate directly into the query.
 */
async function getCommentsForSubject(
  column: SubjectColumn,
  subjectId: string,
  viewerUserId?: string
): Promise<Comment[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT c.*, u.display_name as display_name,
        (SELECT COUNT(*) FROM comment_reactions r WHERE r.comment_id = c.id) as like_count,
        (SELECT COUNT(*) FROM comment_reactions r WHERE r.comment_id = c.id AND r.user_id = ?) as liked_by_me
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.${column} = ?
       ORDER BY c.created_at ASC`
    )
    .bind(viewerUserId ?? '', subjectId)
    .all<CommentRow>();

  return nest(results.map(mapComment));
}

async function addCommentForSubject(
  column: SubjectColumn,
  subjectId: string,
  userId: string,
  body: string,
  parentCommentId?: string
): Promise<Comment> {
  const db = getDb();
  const id = generateId('comment');
  const createdAt = nowIso();
  await db
    .prepare(
      `INSERT INTO comments (id, ${column}, user_id, parent_comment_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, subjectId, userId, parentCommentId ?? null, body, createdAt)
    .run();

  return {
    id,
    quizId: column === 'quiz_id' ? subjectId : null,
    blogPostId: column === 'blog_post_id' ? subjectId : null,
    userId,
    authorName: '', // filled by caller if needed; avoids an extra read here
    parentCommentId: parentCommentId ?? null,
    body,
    createdAt,
    likeCount: 0,
    likedByMe: false,
  };
}

async function getCommentCountForSubject(column: SubjectColumn, subjectId: string): Promise<number> {
  const db = getDb();
  const row = await db
    .prepare(`SELECT COUNT(*) as count FROM comments WHERE ${column} = ?`)
    .bind(subjectId)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

/**
 * Returns comments for a quiz nested into a full reply tree of arbitrary
 * depth. The UI (CommentThread) visually collapses anything past 2
 * levels behind a "View replies" expander — same trick TikTok/Instagram
 * use — so deep threads stay real in the data without turning into an
 * unreadable staircase on screen.
 *
 * `viewerUserId` is optional so logged-out visitors can still read
 * comments; `likedByMe` is just false for them.
 */
export async function getCommentsForQuiz(quizId: string, viewerUserId?: string): Promise<Comment[]> {
  return getCommentsForSubject('quiz_id', quizId, viewerUserId);
}

/** Same as getCommentsForQuiz, but for a blog post's comment thread. */
export async function getCommentsForBlogPost(blogPostId: string, viewerUserId?: string): Promise<Comment[]> {
  return getCommentsForSubject('blog_post_id', blogPostId, viewerUserId);
}

export async function addComment(
  userId: string,
  quizId: string,
  body: string,
  parentCommentId?: string
): Promise<Comment> {
  return addCommentForSubject('quiz_id', quizId, userId, body, parentCommentId);
}

/** Same as addComment, but attaches the comment to a blog post instead of a quiz. */
export async function addCommentToBlogPost(
  userId: string,
  blogPostId: string,
  body: string,
  parentCommentId?: string
): Promise<Comment> {
  return addCommentForSubject('blog_post_id', blogPostId, userId, body, parentCommentId);
}

export async function getCommentById(commentId: string): Promise<Comment | null> {
  const db = getDb();
  const row = await db
    .prepare(
      `SELECT c.*, u.display_name as display_name,
        (SELECT COUNT(*) FROM comment_reactions r WHERE r.comment_id = c.id) as like_count,
        0 as liked_by_me
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`
    )
    .bind(commentId)
    .first<CommentRow>();
  return row ? mapComment(row) : null;
}

/**
 * Deletes a comment and all of its descendants at any depth. With real
 * nesting now supported, a comment can have grandchildren — walking the
 * tree in app code (rather than a single SQL DELETE) guarantees nothing
 * gets orphaned, and avoids relying on recursive CTE support that isn't
 * consistent across D1/SQLite versions.
 */
export async function deleteComment(commentId: string): Promise<void> {
  const db = getDb();

  const idsToDelete = [commentId];
  let frontier = [commentId];
  while (frontier.length > 0) {
    const placeholders = frontier.map(() => '?').join(',');
    const { results } = await db
      .prepare(`SELECT id FROM comments WHERE parent_comment_id IN (${placeholders})`)
      .bind(...frontier)
      .all<{ id: string }>();
    const childIds = results.map((r) => r.id);
    idsToDelete.push(...childIds);
    frontier = childIds;
  }

  const placeholders = idsToDelete.map(() => '?').join(',');
  await db.batch([
    db.prepare(`DELETE FROM comment_reactions WHERE comment_id IN (${placeholders})`).bind(...idsToDelete),
    db.prepare(`DELETE FROM comments WHERE id IN (${placeholders})`).bind(...idsToDelete),
  ]);
}

/** Total comment count for a quiz (top-level + replies), for card/listing badges. */
export async function getCommentCountForQuiz(quizId: string): Promise<number> {
  return getCommentCountForSubject('quiz_id', quizId);
}

/** Total comment count for a blog post (top-level + replies), for card/listing badges. */
export async function getCommentCountForBlogPost(blogPostId: string): Promise<number> {
  return getCommentCountForSubject('blog_post_id', blogPostId);
}

/**
 * Toggles a like on a comment for the given user. Returns the new
 * liked/unliked state and updated like count so the caller doesn't need
 * a second round trip.
 */
export async function toggleCommentLike(
  commentId: string,
  userId: string
): Promise<{ liked: boolean; likeCount: number }> {
  const db = getDb();
  const existing = await db
    .prepare('SELECT id FROM comment_reactions WHERE comment_id = ? AND user_id = ?')
    .bind(commentId, userId)
    .first<{ id: string }>();

  if (existing) {
    await db.prepare('DELETE FROM comment_reactions WHERE id = ?').bind(existing.id).run();
  } else {
    await db
      .prepare('INSERT INTO comment_reactions (id, comment_id, user_id, created_at) VALUES (?, ?, ?, ?)')
      .bind(generateId('reaction'), commentId, userId, nowIso())
      .run();
  }

  const row = await db
    .prepare('SELECT COUNT(*) as count FROM comment_reactions WHERE comment_id = ?')
    .bind(commentId)
    .first<{ count: number }>();

  return { liked: !existing, likeCount: row?.count ?? 0 };
}
