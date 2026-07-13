/**
 * Fixed taxonomy for blog/education content. This mirrors the seed rows
 * in schema.sql / the restructure migration exactly (12 fixed
 * top-level categories, admin cannot add/remove via the UI).
 *
 * This file is not queried at runtime for the category list — the DB
 * (blog_categories table, via blogCategoryService.listBlogCategories)
 * is the source of truth there. This file exists for the small number
 * of places that need a compile-time-known slug, namely the dedicated
 * /jobs and /scholarships pages.
 */
export const BLOG_CATEGORIES = [
  'Anatomy & Physiology',
  'Pharmacology',
  'Microbiology',
  'Pathophysiology',
  'Biochemistry',
  'Nursing',
  'General Clinical',
  'Clinical Specialists',
  'Clinical Scenarios',
  'Others',
  'Job',
  'Scholarship',
] as const;

export type BlogCategoryName = (typeof BLOG_CATEGORIES)[number];

// Slugs for the two categories that get dedicated pages outside /blog.
export const JOB_CATEGORY_SLUG = 'job';
export const SCHOLARSHIP_CATEGORY_SLUG = 'scholarship';

export function slugifyCategory(category: string): string {
  return category.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
