'use client';

import { useEffect, useState } from 'react';

interface SubcategoryOption {
  id: string;
  blogCategoryId: string;
  name: string;
  slug: string;
}

/**
 * Module-level cache shared by every card/component on the page, keyed by
 * blogCategoryId. The public /api/blog list endpoints don't join in
 * subcategory names, so cards resolve them client-side; without this
 * cache, a listing page with a dozen posts across three categories would
 * fire a dozen duplicate requests instead of three.
 */
const subcategoryCache = new Map<string, Promise<SubcategoryOption[]>>();

function loadSubcategories(categoryId: string): Promise<SubcategoryOption[]> {
  let pending = subcategoryCache.get(categoryId);
  if (!pending) {
    pending = fetch(`/api/blog-subcategories?categoryId=${encodeURIComponent(categoryId)}`)
      .then((res) => (res.ok ? res.json() : { subcategories: [] }))
      .then((data) => data.subcategories ?? [])
      .catch(() => []);
    subcategoryCache.set(categoryId, pending);
  }
  return pending;
}

/**
 * Resolves a post's subcategory display name from its
 * (blogCategoryId, blogSubcategoryId) pair. Returns null while loading or
 * when the post has no subcategory set, so callers can simply skip
 * rendering the badge in that case.
 */
export function useBlogSubcategoryName(
  blogCategoryId: string | null | undefined,
  blogSubcategoryId: string | null | undefined
): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    setName(null);
    if (!blogCategoryId || !blogSubcategoryId) return;
    let cancelled = false;
    loadSubcategories(blogCategoryId).then((subs) => {
      if (cancelled) return;
      const match = subs.find((s) => s.id === blogSubcategoryId);
      setName(match?.name ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [blogCategoryId, blogSubcategoryId]);

  return name;
}
