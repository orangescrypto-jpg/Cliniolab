import { getDb, generateId } from '@/lib/db/client';

export interface BlogCategory {
  id: string;
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

function mapBlogCategory(row: BlogCategoryRow): BlogCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sortOrder: row.sort_order,
  };
}

export async function listBlogCategories(): Promise<BlogCategory[]> {
  const db = getDb();
  const { results } = await db
    .prepare('SELECT * FROM blog_categories ORDER BY sort_order ASC')
    .all<BlogCategoryRow>();
  return results.map(mapBlogCategory);
}

export async function createBlogCategory(input: {
  name: string;
  slug: string;
  sortOrder?: number;
}): Promise<BlogCategory> {
  const db = getDb();
  const id = generateId('blogcat');
  await db
    .prepare('INSERT INTO blog_categories (id, name, slug, sort_order) VALUES (?, ?, ?, ?)')
    .bind(id, input.name, input.slug, input.sortOrder ?? 0)
    .run();
  return { id, name: input.name, slug: input.slug, sortOrder: input.sortOrder ?? 0 };
}

export async function deleteBlogCategory(id: string): Promise<void> {
  const db = getDb();
  await db.prepare('DELETE FROM blog_categories WHERE id = ?').bind(id).run();
}
