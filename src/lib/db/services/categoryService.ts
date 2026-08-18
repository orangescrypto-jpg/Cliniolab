import { getDb, generateId } from '@/lib/db/client';
import type { Category, Subcategory } from '@/types';

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
}

interface SubcategoryRow {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sort_order,
  };
}

function mapSubcategory(row: SubcategoryRow): Subcategory {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sort_order,
  };
}

export async function listCategories(): Promise<Category[]> {
  const db = getDb();
  const { results } = await db
    .prepare('SELECT * FROM categories ORDER BY sort_order ASC')
    .all<CategoryRow>();
  return results.map(mapCategory);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const db = getDb();
  const row = await db
    .prepare('SELECT * FROM categories WHERE slug = ?')
    .bind(slug)
    .first<CategoryRow>();
  return row ? mapCategory(row) : null;
}

export async function listSubcategories(categoryId?: string): Promise<Subcategory[]> {
  const db = getDb();
  if (categoryId) {
    const { results } = await db
      .prepare('SELECT * FROM subcategories WHERE category_id = ? ORDER BY sort_order ASC')
      .bind(categoryId)
      .all<SubcategoryRow>();
    return results.map(mapSubcategory);
  }
  const { results } = await db
    .prepare('SELECT * FROM subcategories ORDER BY sort_order ASC')
    .all<SubcategoryRow>();
  return results.map(mapSubcategory);
}

export async function getSubcategoryBySlug(
  categoryId: string,
  slug: string
): Promise<Subcategory | null> {
  const db = getDb();
  const row = await db
    .prepare('SELECT * FROM subcategories WHERE category_id = ? AND slug = ?')
    .bind(categoryId, slug)
    .first<SubcategoryRow>();
  return row ? mapSubcategory(row) : null;
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * Looks up a category by (case-insensitive) name via its slug, creating it
 * if it doesn't exist yet. Mirrors getOrCreateBlogSubcategory's pattern —
 * one row per distinct category name, ever, reused on every later match
 * rather than duplicated. Used by bulk quiz upload so a spreadsheet can
 * introduce a brand-new category without an admin creating it first.
 */
export async function getOrCreateCategory(name: string): Promise<Category> {
  const db = getDb();
  const slug = slugify(name);

  const existing = await db
    .prepare('SELECT * FROM categories WHERE slug = ?')
    .bind(slug)
    .first<CategoryRow>();
  if (existing) return mapCategory(existing);

  const id = generateId('cat');
  await db
    .prepare('INSERT INTO categories (id, name, slug, sort_order) VALUES (?, ?, ?, 0)')
    .bind(id, name, slug)
    .run();
  return { id, name, slug, description: null, sortOrder: 0 };
}

/**
 * Same idea as getOrCreateCategory, but scoped to one category — slugs are
 * only unique per category (see schema: UNIQUE(category_id, slug)), so the
 * same subcategory name can legitimately exist under two different
 * categories without colliding. Matching only within categoryId is what
 * prevents bulk upload from either creating a duplicate subcategory under
 * the same category, or accidentally reusing a same-named subcategory
 * that actually belongs to a different category.
 */
export async function getOrCreateSubcategory(categoryId: string, name: string): Promise<Subcategory> {
  const db = getDb();
  const slug = slugify(name);

  const existing = await db
    .prepare('SELECT * FROM subcategories WHERE category_id = ? AND slug = ?')
    .bind(categoryId, slug)
    .first<SubcategoryRow>();
  if (existing) return mapSubcategory(existing);

  const id = generateId('sub');
  await db
    .prepare(
      'INSERT INTO subcategories (id, category_id, name, slug, sort_order) VALUES (?, ?, ?, ?, 0)'
    )
    .bind(id, categoryId, name, slug)
    .run();
  return { id, categoryId, name, slug, description: null, sortOrder: 0 };
}

export async function createCategory(input: {
  name: string;
  slug: string;
  description?: string;
  sortOrder?: number;
}): Promise<Category> {
  const db = getDb();
  const id = generateId('cat');
  await db
    .prepare(
      'INSERT INTO categories (id, name, slug, description, sort_order) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, input.name, input.slug, input.description ?? null, input.sortOrder ?? 0)
    .run();
  return { id, name: input.name, slug: input.slug, description: input.description ?? null, sortOrder: input.sortOrder ?? 0 };
}

export async function createSubcategory(input: {
  categoryId: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder?: number;
}): Promise<Subcategory> {
  const db = getDb();
  const id = generateId('sub');
  await db
    .prepare(
      'INSERT INTO subcategories (id, category_id, name, slug, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(id, input.categoryId, input.name, input.slug, input.description ?? null, input.sortOrder ?? 0)
    .run();
  return {
    id,
    categoryId: input.categoryId,
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
    sortOrder: input.sortOrder ?? 0,
  };
}

export async function updateCategory(
  id: string,
  input: Partial<{ name: string; slug: string; description: string; sortOrder: number }>
): Promise<void> {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
  if (input.slug !== undefined) { fields.push('slug = ?'); values.push(input.slug); }
  if (input.description !== undefined) { fields.push('description = ?'); values.push(input.description); }
  if (input.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(input.sortOrder); }
  if (fields.length === 0) return;
  values.push(id);
  await db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
}

export async function deleteCategory(id: string): Promise<void> {
  const db = getDb();
  await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
}

export async function deleteSubcategory(id: string): Promise<void> {
  const db = getDb();
  await db.prepare('DELETE FROM subcategories WHERE id = ?').bind(id).run();
}
