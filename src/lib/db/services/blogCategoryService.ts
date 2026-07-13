import { getDb, generateId } from '@/lib/db/client';

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface BlogSubcategory {
  id: string;
  blogCategoryId: string;
  name: string;
  slug: string;
  sortOrder: number;
}

interface BlogCategoryRow {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
}

interface BlogSubcategoryRow {
  id: string;
  blog_category_id: string;
  name: string;
  slug: string;
  sort_order: number;
}

function mapBlogCategory(row: BlogCategoryRow): BlogCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sortOrder: row.sort_order,
  };
}

function mapBlogSubcategory(row: BlogSubcategoryRow): BlogSubcategory {
  return {
    id: row.id,
    blogCategoryId: row.blog_category_id,
    name: row.name,
    slug: row.slug,
    sortOrder: row.sort_order,
  };
}

// The 12 top-level categories are fixed seed data (see schema.sql /
// the restructure migration) — admins cannot add, rename, or delete
// them through the app, so there is deliberately no create/delete
// here anymore.
export async function listBlogCategories(): Promise<BlogCategory[]> {
  const db = getDb();
  const { results } = await db
    .prepare('SELECT * FROM blog_categories ORDER BY sort_order ASC')
    .all<BlogCategoryRow>();
  return results.map(mapBlogCategory);
}

export async function listBlogSubcategories(blogCategoryId: string): Promise<BlogSubcategory[]> {
  const db = getDb();
  const { results } = await db
    .prepare('SELECT * FROM blog_subcategories WHERE blog_category_id = ? ORDER BY sort_order ASC')
    .bind(blogCategoryId)
    .all<BlogSubcategoryRow>();
  return results.map(mapBlogSubcategory);
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * Subcategories are freeform per category and persist for reuse: if an
 * admin types a subcategory name that already exists (by slug) within
 * that category, the existing row is returned instead of creating a
 * duplicate. This is what "saved permanently for reuse next time" means
 * in practice — one row per (category, subcategory name) pair, ever.
 */
export async function getOrCreateBlogSubcategory(
  blogCategoryId: string,
  name: string
): Promise<BlogSubcategory> {
  const db = getDb();
  const slug = slugify(name);

  const existing = await db
    .prepare('SELECT * FROM blog_subcategories WHERE blog_category_id = ? AND slug = ?')
    .bind(blogCategoryId, slug)
    .first<BlogSubcategoryRow>();
  if (existing) return mapBlogSubcategory(existing);

  const id = generateId('blogsubcat');
  await db
    .prepare(
      'INSERT INTO blog_subcategories (id, blog_category_id, name, slug, sort_order) VALUES (?, ?, ?, ?, 0)'
    )
    .bind(id, blogCategoryId, name, slug)
    .run();
  return { id, blogCategoryId, name, slug, sortOrder: 0 };
}

export async function getBlogSubcategoryById(id: string): Promise<BlogSubcategory | null> {
  const db = getDb();
  const row = await db
    .prepare('SELECT * FROM blog_subcategories WHERE id = ?')
    .bind(id)
    .first<BlogSubcategoryRow>();
  return row ? mapBlogSubcategory(row) : null;
}
