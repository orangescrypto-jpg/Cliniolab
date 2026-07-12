'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BlogPostCard } from '@/components/cms/BlogPostCard';
import type { BlogPost } from '@/types';

export default function BlogCategoryPage() {
  const params = useParams<{ category: string }>();
  const categoryName = decodeURIComponent(params.category);
  const [posts, setPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    fetch(`/api/blog?category=${encodeURIComponent(categoryName)}`)
      .then((res) => res.json())
      .then((data) => setPosts(data.posts ?? []));
  }, [categoryName]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">{categoryName}</h1>
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {posts.map((post) => (
          <BlogPostCard key={post.id} post={post} />
        ))}
        {posts.length === 0 && (
          <p className="col-span-full text-sm text-ink-400">No posts in this category yet.</p>
        )}
      </div>
    </div>
  );
}
