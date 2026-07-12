'use client';

import { useEffect, useState } from 'react';
import { BlogPostCard } from '@/components/cms/BlogPostCard';
import type { BlogPost } from '@/types';

interface BlogCategoryOption { id: string; name: string; slug: string; sortOrder: number }

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [blogCategories, setBlogCategories] = useState<BlogCategoryOption[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/blog-categories')
      .then((res) => res.json())
      .then((data) => setBlogCategories(data.categories ?? []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = activeCategory
      ? `/api/blog?category=${encodeURIComponent(activeCategory)}`
      : '/api/blog';
    fetch(url)
      .then((res) => res.json())
      .then((data) => setPosts(data.posts ?? []))
      .finally(() => setLoading(false));
  }, [activeCategory]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">Blog</h1>
      <p className="mt-2 text-ink-500">
        Clinical tips, exam prep guidance, and news for nursing and clinical students.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory('')}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            activeCategory === ''
              ? 'bg-pulse-600 text-white'
              : 'bg-ink-50 text-ink-600 hover:bg-ink-100'
          }`}
        >
          All
        </button>
        {blogCategories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.name)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              activeCategory === c.name
                ? 'bg-pulse-600 text-white'
                : 'bg-ink-50 text-ink-600 hover:bg-ink-100'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {posts.map((post) => (
          <BlogPostCard key={post.id} post={post} />
        ))}
        {!loading && posts.length === 0 && (
          <p className="col-span-full text-sm text-ink-400">No posts yet.</p>
        )}
      </div>
    </div>
  );
}
