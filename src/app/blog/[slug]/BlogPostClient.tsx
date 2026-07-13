'use client';

import { useEffect, useState } from 'react';
import { markdownToHtml } from '@/components/ui/RichTextEditor';
import { sanitizeHtml, wrapWithScopeClass } from '@/lib/utils/sanitizeHtml';
import { ShareButton } from '@/components/quiz/ShareButton';
import { RelatedQuizzes } from '@/components/quiz/RelatedQuizzes';
import { CommentThread } from '@/components/quiz/CommentThread';
import type { BlogPost } from '@/types';

/**
 * A post is a "full raw document" when it's a complete standalone HTML
 * page (doctype/html/head) rather than a content fragment meant to sit
 * inside the site's own layout. These render via a sandboxed iframe (see
 * RawHtmlFrame) instead of the text-level sanitizer, so the author's CSS
 * (including @media, *, arbitrary selectors) renders pixel-perfect
 * without the scoping/stripping tradeoffs of sanitizeHtml. The sandbox
 * attribute means embedded scripts/styles can't touch the parent app,
 * cookies, or admin session — this is a stronger security boundary, not
 * a removed one.
 */
function isFullRawDocument(content: string): boolean {
  const sample = content.slice(0, 1000);
  return (
    /<!DOCTYPE\s+html/i.test(sample) ||
    /<html[\s>]/i.test(sample) ||
    /<head[\s>]/i.test(sample)
  );
}

function looksLikeHtml(content: string): boolean {
  const sample = content.slice(0, 1000);

  // Full document wrapper (doctype/html/head/body).
  if (/<!DOCTYPE\s+html/i.test(sample)) return true;
  if (/<html[\s>]/i.test(sample)) return true;
  if (/<head[\s>]/i.test(sample)) return true;
  if (/<body[\s>]/i.test(sample)) return true;

  // A <style> block is a strong signal someone pasted real HTML/CSS
  // rather than writing markdown.
  if (/<style[\s>]/i.test(sample)) return true;

  // Otherwise, count real HTML tags (open or self-closing) from a
  // reasonably broad set of common block/inline elements. Markdown
  // occasionally contains a stray inline tag, so require a few distinct
  // matches before treating the whole post as HTML rather than markdown.
  const tagMatches = sample.match(
    /<\/?(div|span|p|section|article|header|footer|nav|main|table|tr|td|th|ul|ol|li|h[1-6]|img|a|button|form|label|input|strong|em|br|hr)[\s/>]/gi
  );
  return (tagMatches?.length ?? 0) >= 3;
}

/**
 * Renders a full raw HTML document (with its own <style>, @media, *, etc.)
 * inside a sandboxed iframe sized to its own content. `sandbox="allow-scripts"`
 * (no allow-same-origin, no allow-forms, no allow-top-navigation) means the
 * iframe gets its own opaque origin — any script inside it cannot read the
 * parent page's cookies, session, or DOM, and cannot navigate the parent
 * window. This is what lets us skip sanitizeHtml entirely for this path
 * without reopening the XSS/session-theft risk it exists to prevent.
 */
function RawHtmlFrame({ html }: { html: string }) {
  const [height, setHeight] = useState(600);
  const [frameEl, setFrameEl] = useState<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!frameEl) return;
    const resize = () => {
      try {
        const doc = frameEl.contentDocument;
        if (doc?.documentElement) {
          setHeight(doc.documentElement.scrollHeight + 24);
        }
      } catch {
        // Cross-origin (opaque sandbox origin) — can't read scrollHeight.
        // Falls back to the last known/default height.
      }
    };
    frameEl.addEventListener('load', resize);
    const interval = setInterval(resize, 500);
    return () => {
      frameEl.removeEventListener('load', resize);
      clearInterval(interval);
    };
  }, [frameEl]);

  return (
    <iframe
      ref={setFrameEl}
      srcDoc={html}
      sandbox="allow-scripts allow-popups"
      style={{ width: '100%', height, border: 'none', display: 'block' }}
      title="Post content"
    />
  );
}

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
            {isFullRawDocument(post.content) ? (
              <div className="mt-6">
                <RawHtmlFrame html={post.content} />
              </div>
            ) : (
              <div
                className="prose prose-sm mt-6 max-w-none text-ink-700"
                dangerouslySetInnerHTML={{
                  __html:
                    post.contentFormat === 'html' || looksLikeHtml(post.content)
                      ? wrapWithScopeClass(sanitizeHtml(post.content, post.id), post.id)
                      : markdownToHtml(post.content),
                }}
              />
            )}
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
