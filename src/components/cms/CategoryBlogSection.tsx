'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BlogPostCard } from '@/components/cms/BlogPostCard';
import type { BlogPost } from '@/types';

interface CategoryBlogSectionProps {
  categoryId: string;
  categorySlug: string;
  categoryName: string;
}

export function CategoryBlogSection({ categoryId, categorySlug, categoryName }: CategoryBlogSectionProps) {
  const [posts, setPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    fetch(`/api/blog?categoryId=${encodeURIComponent(categoryId)}&limit=6`)
      .then((res) => res.json())
      .then((data) => setPosts(data.posts ?? []));
  }, [categoryId]);

  if (posts.length === 0) return null; // don't show empty category sections

  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex items-center justify-between">
        <Link href={`/blog/category/${categorySlug}`} className="group">
          <h2 className="font-display text-2xl font-semibold text-ink-800 group-hover:text-pulse-600">
            {categoryName}
          </h2>
        </Link>
        <Link
          href={`/blog/category/${categorySlug}`}
          className="text-sm font-medium text-pulse-600 hover:text-pulse-700"
        >
          See more →
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <BlogPostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
