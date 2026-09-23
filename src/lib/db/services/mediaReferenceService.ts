import { getDb } from '@/lib/db/client';

/**
 * Single source of truth for "which database columns can point at an R2
 * image". Used by:
 *  - the delete hooks (blog / resource / scholar), to avoid removing an
 *    image another row still uses, and
 *  - the weekly orphan sweep, to decide which R2 keys nothing references.
 *
 * If you add a new column that stores an /api/images/... path, add it to
 * IMAGE_COLUMNS or the sweep will treat those images as orphans and
 * delete them.
 */

/** Columns holding a single image path/URL. Matched with LIKE '%<key>%'. */
const IMAGE_COLUMNS: { table: string; column: string }[] = [
  { table: 'blog_posts', column: 'featured_image_url' },
  { table: 'resources', column: 'cover_image_url' },
  { table: 'resource_purchases', column: 'proof_image_url' },
  { table: 'banners', column: 'image_path' },
  { table: 'scholars_of_the_day', column: 'photo_url' },
  { table: 'users', column: 'avatar_path' },
];

/** Columns holding free-form content that may embed <img src="/api/images/..."> inline. */
const CONTENT_COLUMNS: { table: string; column: string }[] = [
  { table: 'blog_posts', column: 'content' },
  { table: 'static_pages', column: 'content' },
];

/** Escapes LIKE wildcards so a key containing _ or % matches literally. */
function likePattern(key: string): string {
  return `%${key.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * True if any row in any image-bearing column still references this R2 key.
 * `excluding` lets a delete hook ignore the row it is about to remove (or
 * has just removed) so a post's own cover doesn't count as a reference to
 * itself.
 */
export async function isImageKeyReferenced(
  key: string,
  excluding?: { table: string; id: string }
): Promise<boolean> {
  const db = getDb();
  const pattern = likePattern(key);

  for (const { table, column } of [...IMAGE_COLUMNS, ...CONTENT_COLUMNS]) {
    const excludeClause = excluding && excluding.table === table ? ' AND id != ?' : '';
    const stmt = db.prepare(
      `SELECT 1 FROM ${table} WHERE ${column} LIKE ? ESCAPE '\\'${excludeClause} LIMIT 1`
    );
    const row = await (excludeClause ? stmt.bind(pattern, excluding!.id) : stmt.bind(pattern)).first();
    if (row) return true;
  }
  return false;
}

/**
 * Loads every referenced image key into memory in one pass, for the sweep.
 * Cheaper than calling isImageKeyReferenced once per R2 object (which would
 * be objects x columns queries and blow through D1's row-read budget).
 */
export async function getAllReferencedImageText(): Promise<string[]> {
  const db = getDb();
  const chunks: string[] = [];
  for (const { table, column } of [...IMAGE_COLUMNS, ...CONTENT_COLUMNS]) {
    const { results } = await db
      .prepare(`SELECT ${column} AS v FROM ${table} WHERE ${column} IS NOT NULL AND ${column} LIKE '%/api/images/%'`)
      .all<{ v: string }>();
    for (const r of results) chunks.push(r.v);
  }
  return chunks;
}
