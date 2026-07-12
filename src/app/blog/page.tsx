'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import type { BlogPost } from '@/types';

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    fetch('/api/blog')
      .then((res) => res.json())
      .then((data) => setPosts(data.posts ?? []));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">Blog</h1>
      <div className="mt-8 space-y-4">
        {posts.map((post) => (
          <Link key={post.id} href={`/blog/${post.slug}`}>
            <Card className="p-5 transition-shadow hover:shadow-md">
              <h2 className="font-display text-lg font-semibold text-ink-800">{post.title}</h2>
              <p className="mt-1 text-xs text-ink-400">
                {new Date(post.createdAt).toLocaleDateString()}
              </p>
            </Card>
          </Link>
        ))}
        {posts.length === 0 && <p className="text-sm text-ink-400">No posts published yet.</p>}
      </div>
    </div>
  );
}
