import { getDb, generateId } from '@/lib/db/client';
import type { ResourceCategory, ResourceKind } from '@/types';

interface ResourceCategoryRow {
  id: string;
  kind: string;
  name: string;
  slug: string;
  sort_order: number;
}

function mapCategory(row: ResourceCategoryRow): ResourceCategory {
  return {
    id: row.id,
    kind: row.kind as ResourceKind,
    name: row.name,
    slug: row.slug,
    sortOrder: row.sort_order,
  };
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** All categories, or only those scoped to one kind ('book' | 'past_question_pack'). */
export async function listResourceCategories(kind?: ResourceKind): Promise<ResourceCategory[]> {
  const db = getDb();
  if (kind) {
    const { results } = await db
      .prepare('SELECT * FROM resource_categories WHERE kind = ? ORDER BY sort_order ASC, name ASC')
      .bind(kind)
      .all<ResourceCategoryRow>();
    return results.map(mapCategory);
  }
  const { results } = await db
    .prepare('SELECT * FROM resource_categories ORDER BY kind ASC, sort_order ASC, name ASC')
    .all<ResourceCategoryRow>();
  return results.map(mapCategory);
}

export async function createResourceCategory(input: {
  kind: ResourceKind;
  name: string;
  sortOrder?: number;
}): Promise<ResourceCategory> {
  const db = getDb();
  const id = generateId('rescat');
  const slug = slugify(input.name);
  await db
    .prepare(
      'INSERT INTO resource_categories (id, kind, name, slug, sort_order) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, input.kind, input.name, slug, input.sortOrder ?? 0)
    .run();
  return { id, kind: input.kind, name: input.name, slug, sortOrder: input.sortOrder ?? 0 };
}

/**
 * Looks up a resource category by (kind, name-derived slug), creating it if
 * it doesn't exist yet — lets an admin introduce a brand-new category
 * directly from the "Add resource" form without a separate setup step.
 * Matching is scoped to `kind` so "OSCE" under Books and "OSCE" under Past
 * Question Packs stay independent rows (mirrors getOrCreateSubcategory).
 */
export async function getOrCreateResourceCategory(
  kind: ResourceKind,
  name: string
): Promise<ResourceCategory> {
  const db = getDb();
  const slug = slugify(name);

  const existing = await db
    .prepare('SELECT * FROM resource_categories WHERE kind = ? AND slug = ?')
    .bind(kind, slug)
    .first<ResourceCategoryRow>();
  if (existing) return mapCategory(existing);

  return createResourceCategory({ kind, name });
}

export async function deleteResourceCategory(id: string): Promise<{ deleted: boolean; reason?: string }> {
  const db = getDb();
  const inUse = await db
    .prepare('SELECT COUNT(*) as count FROM resources WHERE category_id = ?')
    .bind(id)
    .first<{ count: number }>();
  if (inUse && inUse.count > 0) {
    return { deleted: false, reason: 'Category is still used by one or more resources.' };
  }
  await db.prepare('DELETE FROM resource_categories WHERE id = ?').bind(id).run();
  return { deleted: true };
}
