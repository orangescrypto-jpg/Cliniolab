import { getDb, generateId, nowIso } from '@/lib/db/client';
import type { BlogContentFormat, BlogPost, BlogStatus, StaticPage } from '@/types';

interface BlogRow {
  id: string;
  author_id: string;
  title: string;
  slug: string;
  content: string;
  content_format: string;
  excerpt: string | null;
  category: string | null;
  featured_image_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  status: string;
  is_sponsored: number;
  is_pinned: number;
  send_as_newsletter: number;
  newsletter_sent_at: string | null;
  created_at: string;
}

interface PageRow {
  id: string;
  title: string;
  content: string;
  updated_at: string;
}

function mapBlog(row: BlogRow): BlogPost {
  return {
    id: row.id,
    authorId: row.author_id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    contentFormat: (row.content_format as BlogContentFormat) ?? 'markdown',
    excerpt: row.excerpt,
    category: row.category,
    featuredImageUrl: row.featured_image_url,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    status: row.status as BlogStatus,
    isSponsored: row.is_sponsored === 1,
    isPinned: row.is_pinned === 1,
    sendAsNewsletter: row.send_as_newsletter === 1,
    newsletterSentAt: row.newsletter_sent_at,
    createdAt: row.created_at,
  };
}

function mapPage(row: PageRow): StaticPage {
  return { id: row.id, title: row.title, content: row.content, updatedAt: row.updated_at };
}

// ---- Blog (admin/moderator only to write; public reads published only) ----
// Pinned posts always sort first, then newest first within each group.

export async function listPublishedPosts(limit?: number): Promise<BlogPost[]> {
  const db = getDb();
  const query = `SELECT * FROM blog_posts WHERE status = 'published' ORDER BY is_pinned DESC, created_at DESC${
    limit ? ' LIMIT ?' : ''
  }`;
  const stmt = limit ? db.prepare(query).bind(limit) : db.prepare(query);
  const { results } = await stmt.all<BlogRow>();
  return results.map(mapBlog);
}

export async function getPostsByCategory(category: string, limit?: number): Promise<BlogPost[]> {
  const db = getDb();
  const query = `SELECT * FROM blog_posts WHERE status = 'published' AND category = ? ORDER BY is_pinned DESC, created_at DESC${
    limit ? ' LIMIT ?' : ''
  }`;
  const stmt = limit ? db.prepare(query).bind(category, limit) : db.prepare(query).bind(category);
  const { results } = await stmt.all<BlogRow>();
  return results.map(mapBlog);
}

export async function adminListAllPosts(): Promise<BlogPost[]> {
  const db = getDb();
  const { results } = await db
    .prepare('SELECT * FROM blog_posts ORDER BY is_pinned DESC, created_at DESC')
    .all<BlogRow>();
  return results.map(mapBlog);
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const db = getDb();
  const row = await db
    .prepare("SELECT * FROM blog_posts WHERE slug = ? AND status = 'published'")
    .bind(slug)
    .first<BlogRow>();
  return row ? mapBlog(row) : null;
}

export async function createPost(
  authorId: string,
  input: {
    title: string;
    slug: string;
    content: string;
    contentFormat?: BlogContentFormat;
    excerpt?: string;
    status: BlogStatus;
    category?: string;
    featuredImageUrl?: string;
    seoTitle?: string;
    seoDescription?: string;
    isSponsored?: boolean;
    isPinned?: boolean;
    sendAsNewsletter?: boolean;
  }
): Promise<BlogPost> {
  const db = getDb();
  const id = generateId('post');
  const createdAt = nowIso();
  await db
    .prepare(
      `INSERT INTO blog_posts
        (id, author_id, title, slug, content, content_format, excerpt, category, featured_image_url, seo_title, seo_description, status, is_sponsored, is_pinned, send_as_newsletter, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      authorId,
      input.title,
      input.slug,
      input.content,
      input.contentFormat ?? 'markdown',
      input.excerpt ?? null,
      input.category ?? null,
      input.featuredImageUrl ?? null,
      input.seoTitle ?? null,
      input.seoDescription ?? null,
      input.status,
      input.isSponsored ? 1 : 0,
      input.isPinned ? 1 : 0,
      input.sendAsNewsletter ? 1 : 0,
      createdAt
    )
    .run();
  return {
    id,
    authorId,
    title: input.title,
    slug: input.slug,
    content: input.content,
    contentFormat: input.contentFormat ?? 'markdown',
    excerpt: input.excerpt ?? null,
    category: input.category ?? null,
    featuredImageUrl: input.featuredImageUrl ?? null,
    seoTitle: input.seoTitle ?? null,
    seoDescription: input.seoDescription ?? null,
    status: input.status,
    isSponsored: input.isSponsored ?? false,
    isPinned: input.isPinned ?? false,
    sendAsNewsletter: input.sendAsNewsletter ?? false,
    newsletterSentAt: null,
    createdAt,
  };
}

export async function updatePost(
  id: string,
  input: Partial<{
    title: string;
    slug: string;
    content: string;
    contentFormat: BlogContentFormat;
    excerpt: string;
    status: BlogStatus;
    category: string;
    featuredImageUrl: string;
    seoTitle: string;
    seoDescription: string;
    isSponsored: boolean;
    isPinned: boolean;
  }>
): Promise<void> {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (input.title !== undefined) { fields.push('title = ?'); values.push(input.title); }
  if (input.slug !== undefined) { fields.push('slug = ?'); values.push(input.slug); }
  if (input.content !== undefined) { fields.push('content = ?'); values.push(input.content); }
  if (input.contentFormat !== undefined) { fields.push('content_format = ?'); values.push(input.contentFormat); }
  if (input.excerpt !== undefined) { fields.push('excerpt = ?'); values.push(input.excerpt); }
  if (input.status !== undefined) { fields.push('status = ?'); values.push(input.status); }
  if (input.category !== undefined) { fields.push('category = ?'); values.push(input.category); }
  if (input.featuredImageUrl !== undefined) { fields.push('featured_image_url = ?'); values.push(input.featuredImageUrl); }
  if (input.seoTitle !== undefined) { fields.push('seo_title = ?'); values.push(input.seoTitle); }
  if (input.seoDescription !== undefined) { fields.push('seo_description = ?'); values.push(input.seoDescription); }
  if (input.isSponsored !== undefined) { fields.push('is_sponsored = ?'); values.push(input.isSponsored ? 1 : 0); }
  if (input.isPinned !== undefined) { fields.push('is_pinned = ?'); values.push(input.isPinned ? 1 : 0); }
  if (fields.length === 0) return;
  values.push(id);
  await db.prepare(`UPDATE blog_posts SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
}

export async function markNewsletterSent(postId: string): Promise<void> {
  const db = getDb();
  await db
    .prepare('UPDATE blog_posts SET newsletter_sent_at = ? WHERE id = ?')
    .bind(nowIso(), postId)
    .run();
}

export async function deletePost(id: string): Promise<void> {
  const db = getDb();
  await db.prepare('DELETE FROM blog_posts WHERE id = ?').bind(id).run();
}

export async function getPostById(id: string): Promise<BlogPost | null> {
  const db = getDb();
  const row = await db.prepare('SELECT * FROM blog_posts WHERE id = ?').bind(id).first<BlogRow>();
  return row ? mapBlog(row) : null;
}

// ---- Static pages (About, Contact, Terms, Privacy, FAQ, Disclaimer) ----

export async function getStaticPage(id: string): Promise<StaticPage | null> {
  const db = getDb();
  const row = await db.prepare('SELECT * FROM static_pages WHERE id = ?').bind(id).first<PageRow>();
  return row ? mapPage(row) : null;
}

export async function listStaticPages(): Promise<StaticPage[]> {
  const db = getDb();
  const { results } = await db.prepare('SELECT * FROM static_pages').all<PageRow>();
  return results.map(mapPage);
}

/** Admin edits page content directly - upserts since pages are seeded by id. */
export async function upsertStaticPage(id: string, title: string, content: string): Promise<void> {
  const db = getDb();
  const updatedAt = nowIso();
  await db
    .prepare(
      `INSERT INTO static_pages (id, title, content, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title, content = excluded.content, updated_at = excluded.updated_at`
    )
    .bind(id, title, content, updatedAt)
    .run();
}
