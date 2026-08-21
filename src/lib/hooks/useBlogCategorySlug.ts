'use client';

import { useEffect, useState } from 'react';

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

/**
 * Module-level cache so every card on a listing page shares one fetch of
 * the fixed 12-category list, instead of each card requesting it separately.
 */
let categoryListPromise: Promise<CategoryOption[]> | null = null;

function loadCategories(): Promise<CategoryOption[]> {
  if (!categoryListPromise) {
    categoryListPromise = fetch('/api/blog-categories')
      .then((res) => (res.ok ? res.json() : { categories: [] }))
      .then((data) => data.categories ?? [])
      .catch(() => []);
  }
  return categoryListPromise;
}

/**
 * Resolves a post's top-level category slug (e.g. 'job', 'scholarship')
 * from its blogCategoryId. Returns null while loading or if the post has
 * no category set, so callers can fall back to a default in that case.
 */
export function useBlogCategorySlug(blogCategoryId: string | null | undefined): string | null {
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    setSlug(null);
    if (!blogCategoryId) return;
    let cancelled = false;
    loadCategories().then((categories) => {
      if (cancelled) return;
      const match = categories.find((c) => c.id === blogCategoryId);
      setSlug(match?.slug ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [blogCategoryId]);

  return slug;
}
