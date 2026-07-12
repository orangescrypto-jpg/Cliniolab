/**
 * Fixed taxonomy for blog/education content, shown as the homepage's
 * 2-column category grid (General Medicine, Clinical Scenarios, etc).
 * Single source of truth - imported by both the admin blog editor and
 * the homepage/category pages so the list can't drift out of sync.
 */
export const BLOG_CATEGORIES = [
  'General Medicine',
  'Clinical Scenarios',
  'Nursing',
  'Anatomy',
  'Physiology',
  'Pharmacology',
  'Scholarship',
  'Job',
  'Others',
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export function slugifyCategory(category: string): string {
  return category.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
