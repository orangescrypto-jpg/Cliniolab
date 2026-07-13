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
/**
 * Many authors paste a full HTML document that was never designed with a
 * mobile viewport in mind (no <meta name="viewport">, or fixed pixel
 * widths). Without a viewport meta tag, phones render the iframe's
 * document at a default desktop-width viewport (~980px) and then scale
 * it down, which is what makes pasted posts look cramped/tiny on mobile.
 * We inject one if the author didn't include their own, so the page
 * lays out at the actual device width instead of a shrunken desktop view.
 */
/**
 * A viewport meta tag alone stops the browser from *scaling down* a
 * desktop-width page, but it doesn't help if the author's own CSS hardcodes
 * pixel widths (e.g. `body { width: 1080px }`, a wrapper `<div
 * style="width:1000px">`, or a wide fixed-width table). In that case the
 * content renders at true 1:1 size but still doesn't fit the phone — it
 * just looks "boxed in" with dead space on either side, or gets clipped.
 *
 * This stylesheet is appended (not prepended) so it wins the cascade
 * against the author's own <style> block via source order, while staying
 * low-specificity enough not to break intentional layouts:
 * - Caps body/html and common wrapper elements to 100% of the viewport
 *   width instead of a fixed px value.
 * - Lets any element that's still wider than the viewport (e.g. a big
 *   table) scroll horizontally in its own box, rather than blowing out
 *   the whole page width.
 * - Forces all images/media to scale down to fit.
 */
const RESPONSIVE_OVERRIDE_CSS = `
<style>
  html, body {
    max-width: 100% !important;
    overflow-x: hidden !important;
    background: #F7F5F0 !important;
    margin: 0 !important;
  }
  /* Flatten the common "boxed card" pattern: a wrapper div (or the body
     itself) with its own white/light background, box-shadow, border,
     border-radius, or outer margin. This is what makes pasted HTML read
     as a floating rectangle instead of flowing text. Padding is left
     alone so inner spacing/readability isn't disturbed. */
  body, body > * {
    max-width: 100% !important;
    background: transparent !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    border: none !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }
  img, video, iframe, canvas, svg { max-width: 100% !important; height: auto !important; }
  table { display: block !important; max-width: 100% !important; overflow-x: auto !important; }
  pre { max-width: 100% !important; overflow-x: auto !important; }
  * { box-sizing: border-box !important; }
</style>
`;

function ensureViewportMeta(html: string): string {
  if (/<meta[^>]+name=["']viewport["']/i.test(html)) return html;
  const viewportTag = '<meta name="viewport" content="width=device-width, initial-scale=1">';
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}${viewportTag}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (match) => `${match}<head>${viewportTag}</head>`);
  }
  return `${viewportTag}${html}`;
}

/** Injects the responsive override stylesheet right before </head> so it loads after, and wins the cascade against, the author's own styles — flattening any boxed/card look into flush, full-width, page-matching content. */
function injectResponsiveOverrides(html: string): string {
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${RESPONSIVE_OVERRIDE_CSS}</head>`);
  }
  if (/<\/html>/i.test(html)) {
    return html.replace(/<\/html>/i, `${RESPONSIVE_OVERRIDE_CSS}</html>`);
  }
  return `${html}${RESPONSIVE_OVERRIDE_CSS}`;
}

const FLATTEN_BOXED_CONTENT_CSS = `
  .post-content-flatten, .post-content-flatten * {
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
  .post-content-flatten > div,
  .post-content-flatten > section,
  .post-content-flatten > article {
    width: 100% !important;
    background: transparent !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    border: none !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }
  .post-content-flatten img,
  .post-content-flatten video,
  .post-content-flatten iframe,
  .post-content-flatten svg {
    max-width: 100% !important;
    height: auto !important;
  }
  .post-content-flatten table {
    display: block !important;
    max-width: 100% !important;
    overflow-x: auto !important;
  }
  .post-content-flatten pre {
    max-width: 100% !important;
    overflow-x: auto !important;
  }
`;

function RawHtmlFrame({ html }: { html: string }) {
  const [height, setHeight] = useState(600);
  const [frameEl, setFrameEl] = useState<HTMLIFrameElement | null>(null);
  const scopedHtml = injectResponsiveOverrides(ensureViewportMeta(html));

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
      srcDoc={scopedHtml}
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
              <>
                <style>{FLATTEN_BOXED_CONTENT_CSS}</style>
                <div
                  className="post-content-flatten prose prose-sm mt-6 max-w-none text-ink-700"
                  dangerouslySetInnerHTML={{
                    __html:
                      post.contentFormat === 'html' || looksLikeHtml(post.content)
                        ? wrapWithScopeClass(sanitizeHtml(post.content, post.id), post.id)
                        : markdownToHtml(post.content),
                  }}
                />
              </>
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
