'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { BlogPost } from '@/types';

interface CompactTeaserBlogSectionProps {
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  /** Small emoji/icon shown in the badge, e.g. "💡" for Clinical Pearls, "📝" for Exam Prep Guides. */
  icon: string;
  /** Short one-line description shown under the section heading. */
  tagline: string;
  limit?: number;
}

/** Strips HTML/markdown-ish characters and truncates for a compact-card preview. */
function fallbackExcerpt(content: string, length = 90): string {
  const stripped = content.replace(/<[^>]*>/g, ' ').replace(/[#*_>[\]()!-]/g, '').replace(/\s+/g, ' ').trim();
  return stripped.length > length ? `${stripped.slice(0, length).trimEnd()}…` : stripped;
}

/**
 * Compact, badge-style card section — deliberately different from
 * CategoryBlogSection's big-image layout so Clinical Pearls / Exam Prep
 * Guides read as quick-hit reference cards rather than full articles.
 */
export function CompactTeaserBlogSection({
  categoryId,
  categorySlug,
  categoryName,
  icon,
  tagline,
  limit = 6,
}: CompactTeaserBlogSectionProps) {
  const [posts, setPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    fetch(`/api/blog?categoryId=${encodeURIComponent(categoryId)}&limit=${limit}`)
      .then((res) => res.json())
      .then((data) => setPosts(data.posts ?? []));
  }, [categoryId, limit]);

  if (posts.length === 0) return null; // don't show empty sections

  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex items-center justify-between">
        <Link href={`/blog/category/${categorySlug}`} className="group flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pulse-50 text-lg">
            {icon}
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold text-ink-800 group-hover:text-pulse-600">
              {categoryName}
            </h2>
            <p className="text-xs text-ink-400">{tagline}</p>
          </div>
        </Link>
        <Link
          href={`/blog/category/${categorySlug}`}
          className="shrink-0 text-sm font-medium text-pulse-600 hover:text-pulse-700"
        >
          See more →
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <Link key={post.id} href={`/blog/${post.slug}`}>
            <div className="h-full rounded-lg border border-ink-100 bg-paper p-4 transition-shadow hover:shadow-md">
              <span className="inline-flex items-center gap-1 rounded-full bg-pulse-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-pulse-600">
                {icon} {categoryName}
              </span>
              <h3 className="mt-2 font-display text-sm font-semibold leading-snug text-ink-800">
                {post.title}
              </h3>
              <p className="mt-1 text-xs text-ink-500 line-clamp-2">
                {post.excerpt || fallbackExcerpt(post.content)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
