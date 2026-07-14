'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { useBlogSubcategoryName } from '@/lib/hooks/useBlogSubcategoryName';
import type { BlogPost } from '@/types';

/** Strips HTML/markdown-ish characters and truncates for a listing-card preview. */
function fallbackExcerpt(content: string, length = 140): string {
  const stripped = content.replace(/<[^>]*>/g, ' ').replace(/[#*_>[\]()!-]/g, '').replace(/\s+/g, ' ').trim();
  return stripped.length > length ? `${stripped.slice(0, length).trimEnd()}…` : stripped;
}

export function BlogPostCard({ post }: { post: BlogPost }) {
  const excerpt = post.excerpt || fallbackExcerpt(post.content);
  const subcategoryName = useBlogSubcategoryName(post.blogCategoryId, post.blogSubcategoryId);
  return (
    <Link href={`/blog/${post.slug}`}>
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        {post.featuredImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.featuredImageUrl} alt="" className="h-36 w-full object-cover" />
        )}
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            {post.isPinned && (
              <span className="rounded bg-flag-50 px-2 py-0.5 text-xs font-medium text-flag-600">Pinned</span>
            )}
            {post.isSponsored && (
              <span className="rounded bg-pulse-50 px-2 py-0.5 text-xs font-medium text-pulse-600">Sponsored</span>
            )}
            {post.category && (
              <span className="text-xs font-medium text-ink-400">{post.category}</span>
            )}
            {subcategoryName && (
              <span className="rounded bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-500">
                {subcategoryName}
              </span>
            )}
          </div>
          <h3 className="mt-2 font-display text-lg font-semibold text-ink-800">{post.title}</h3>
          {excerpt && <p className="mt-1 text-sm text-ink-500 line-clamp-2">{excerpt}</p>}
          <p className="mt-2 text-xs text-ink-400">{new Date(post.createdAt).toLocaleDateString()}</p>
        </div>
      </Card>
    </Link>
  );
}
