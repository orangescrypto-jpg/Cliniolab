'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BlogPostCard } from '@/components/cms/BlogPostCard';
import type { BlogPost } from '@/types';

export function CategoryBlogSection({ category }: { category: string }) {
  const [posts, setPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    fetch(`/api/blog?category=${encodeURIComponent(category)}&limit=4`)
      .then((res) => res.json())
      .then((data) => setPosts(data.posts ?? []));
  }, [category]);

  if (posts.length === 0) return null; // don't show empty category sections

  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold text-ink-800">{category}</h2>
        <Link
          href={`/blog/category/${encodeURIComponent(category)}`}
          className="text-sm font-medium text-pulse-600 hover:text-pulse-700"
        >
          See more →
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {posts.map((post) => (
          <BlogPostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
