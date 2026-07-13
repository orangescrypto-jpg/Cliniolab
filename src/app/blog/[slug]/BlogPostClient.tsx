'use client';

import { useEffect, useState } from 'react';
import { markdownToHtml } from '@/components/ui/RichTextEditor';
import { sanitizeHtml, wrapWithScopeClass } from '@/lib/utils/sanitizeHtml';
import { ShareButton } from '@/components/quiz/ShareButton';
import { RelatedQuizzes } from '@/components/quiz/RelatedQuizzes';
import { CommentThread } from '@/components/quiz/CommentThread';
import type { BlogPost } from '@/types';

export function BlogPostClient({ slug }: { slug: string }) {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/blog/${slug}`)
      .then((res) => {
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => data && setPost(data.post));
  }, [slug]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Post not found</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      {post && (
        <>
          <div className="mx-auto max-w-2xl">
            {post.featuredImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.featuredImageUrl}
                alt=""
                className="mb-6 h-64 w-full rounded-lg object-cover"
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              {post.isPinned && (
                <span className="rounded bg-flag-50 px-2 py-0.5 text-xs font-medium text-flag-600">Pinned</span>
              )}
              {post.isSponsored && (
                <span className="rounded bg-pulse-50 px-2 py-0.5 text-xs font-medium text-pulse-600">Sponsored</span>
              )}
              {post.category && <span className="text-xs font-medium text-ink-400">{post.category}</span>}
            </div>
            <div className="mt-2 flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
              <h1 className="font-display text-3xl font-semibold text-ink-800">{post.title}</h1>
              {typeof window !== 'undefined' && (
                <ShareButton url={window.location.href} title={post.title} />
              )}
            </div>
            <p className="mt-2 text-xs text-ink-400">{new Date(post.createdAt).toLocaleDateString()}</p>
            <div
              className="prose prose-sm mt-6 max-w-none text-ink-700"
              dangerouslySetInnerHTML={{
                __html:
                  post.contentFormat === 'html'
                    ? wrapWithScopeClass(sanitizeHtml(post.content, post.id), post.id)
                    : markdownToHtml(post.content),
              }}
            />
          </div>
          <CommentThread
            endpoint={`/api/blog/${post.id}/comments`}
            placeholder="Share your thoughts on this post…"
          />
          <RelatedQuizzes endpoint={`/api/blog/${slug}/related`} title="Practice quizzes for this topic" />
        </>
      )}
    </div>
  );
}
