'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { ImagePicker } from '@/components/ui/ImagePicker';
import { TiptapEditor } from '@/components/ui/TiptapEditor';
import type { BlogContentFormat, BlogPost, BlogStatus } from '@/types';

interface BlogCategoryOption { id: string; name: string; slug: string; sortOrder: number }

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Simple traffic-light guidance matching the convention most SEO plugins (Yoast, RankMath) use. */
function lengthHint(length: number, ideal: [number, number]): { label: string; color: string } {
  if (length === 0) return { label: 'Not set — will fall back to an auto-generated value', color: 'text-ink-400' };
  if (length < ideal[0]) return { label: `${length} characters — a bit short`, color: 'text-flag-600' };
  if (length > ideal[1]) return { label: `${length} characters — may get truncated in search results`, color: 'text-critical-500' };
  return { label: `${length} characters — good length`, color: 'text-pulse-600' };
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  // Tiptap always authors real HTML, so new/edited posts are always saved
  // as 'html'. Existing 'markdown' posts already in the DB are unaffected
  // and still render via the old markdown path on the public blog page.
  const [contentFormat, setContentFormat] = useState<BlogContentFormat>('html');
  const [featuredImageUrl, setFeaturedImageUrl] = useState('');
  const [blogCategories, setBlogCategories] = useState<BlogCategoryOption[]>([]);
  const [category, setCategory] = useState<string>('');
  const [newBlogCategoryName, setNewBlogCategoryName] = useState('');
  const [status, setStatus] = useState<BlogStatus>('draft');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [isSponsored, setIsSponsored] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [sendAsNewsletter, setSendAsNewsletter] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch('/api/admin/blog')
      .then((res) => res.json())
      .then((data) => setPosts(data.posts ?? []));
  }

  useEffect(load, []);

  function loadBlogCategories() {
    fetch('/api/blog-categories')
      .then((res) => res.json())
      .then((data) => {
        const cats: BlogCategoryOption[] = data.categories ?? [];
        setBlogCategories(cats);
        setCategory((current) => current || cats[0]?.name || '');
      });
  }

  useEffect(loadBlogCategories, []);

  async function addBlogCategory() {
    if (!newBlogCategoryName.trim()) return;
    setError(null);
    const res = await fetch('/api/admin/blog-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newBlogCategoryName, slug: slugify(newBlogCategoryName) }),
    });
    if (res.ok) {
      setNewBlogCategoryName('');
      loadBlogCategories();
    } else {
      const data = await res.json();
      setError(data.error);
    }
  }

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setSlug('');
    setSlugTouched(false);
    setContent('');
    setExcerpt('');
    setContentFormat('html');
    setFeaturedImageUrl('');
    setCategory((blogCategories[0]?.name) || '');
    setStatus('draft');
    setSeoTitle('');
    setSeoDescription('');
    setIsSponsored(false);
    setIsPinned(false);
    setSendAsNewsletter(false);
    setError(null);
  }

  function startEdit(post: BlogPost) {
    setEditingId(post.id);
    setTitle(post.title);
    setSlug(post.slug);
    setSlugTouched(true); // don't auto-overwrite the slug while editing an existing post
    setContent(post.content);
    setExcerpt(post.excerpt ?? '');
    setContentFormat(post.contentFormat);
    setFeaturedImageUrl(post.featuredImageUrl ?? '');
    setCategory(post.category ?? blogCategories[0]?.name ?? '');
    setStatus(post.status);
    setSeoTitle(post.seoTitle ?? '');
    setSeoDescription(post.seoDescription ?? '');
    setIsSponsored(post.isSponsored);
    setIsPinned(post.isPinned);
    setSendAsNewsletter(false); // never re-trigger a newsletter send just by opening an edit
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function removePost(post: BlogPost) {
    if (!window.confirm(`Delete "${post.title}"? This can't be undone.`)) return;
    const res = await fetch(`/api/admin/blog/${post.id}`, { method: 'DELETE' });
    if (res.ok) {
      if (editingId === post.id) resetForm();
      load();
    } else {
      const data = await res.json();
      setError(data.error);
    }
  }

  // Auto-derive the slug from the title until the admin manually edits
  // the slug field themselves — same UX WordPress uses.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  async function savePost() {
    if (!title.trim() || !content.trim()) return;
    setError(null);
    const payload = {
      title,
      slug: slug || slugify(title),
      content,
      contentFormat,
      excerpt: excerpt || undefined,
      featuredImageUrl: featuredImageUrl || undefined,
      category,
      status,
      seoTitle: seoTitle || undefined,
      seoDescription: seoDescription || undefined,
      isSponsored,
      isPinned,
      sendAsNewsletter,
    };
    const res = editingId
      ? await fetch(`/api/admin/blog/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/blog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
    if (res.ok) {
      resetForm();
      load();
    } else {
      const data = await res.json();
      setError(data.error);
    }
  }

  const titleHint = lengthHint((seoTitle || title).length, [40, 60]);
  const descriptionHint = lengthHint(seoDescription.length, [120, 160]);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">
        {editingId ? 'Edit post' : 'Blog'}
      </h1>
      <p className="mt-1 text-sm text-ink-500">
        Jobs and Scholarships listings are just posts tagged with those categories — pick them
        below like any other post.
      </p>

      <Card className="mt-6 space-y-4 p-5">
        <div>
          <label className="text-sm font-medium text-ink-700">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title"
            className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-ink-700">URL slug</label>
          <div className="mt-1 flex items-center gap-1 text-sm text-ink-400">
            <span>/blog/</span>
            <input
              value={slug}
              onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
              className="flex-1 rounded-md border border-ink-100 px-3 py-1.5 text-sm text-ink-700 focus:border-pulse-400 focus:outline-none"
            />
          </div>
        </div>

        <ImagePicker value={featuredImageUrl} onChange={setFeaturedImageUrl} purpose="blog" label="Featured image" />

        <div>
          <label className="text-sm font-medium text-ink-700">Content</label>
          <div className="mt-1">
            <TiptapEditor
              value={content}
              onChange={setContent}
              uploadPurpose="blog"
              placeholder="Write your post…"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-ink-700">Excerpt</label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={3}
            placeholder="Short summary shown on the blog listing page, in newsletters, and social previews. Falls back to an auto-generated excerpt from the content if left blank."
            className="mt-1 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          />
          <p className="mt-1 text-xs text-ink-400">{excerpt.length} characters</p>
        </div>

        {/* SEO panel — WordPress/Yoast-style overrides, separate from the post title/content itself */}
        <div className="rounded-md border border-ink-100 p-4">
          <p className="text-sm font-semibold text-ink-700">Search appearance (SEO)</p>
          <div className="mt-3">
            <label className="text-xs font-medium text-ink-600">SEO title</label>
            <input
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder={title || 'Falls back to the post title above'}
              className="mt-1 w-full rounded-md border border-ink-100 px-3 py-1.5 text-sm focus:border-pulse-400 focus:outline-none"
            />
            <p className={`mt-1 text-xs ${titleHint.color}`}>{titleHint.label}</p>
          </div>
          <div className="mt-3">
            <label className="text-xs font-medium text-ink-600">Meta description</label>
            <textarea
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              rows={2}
              placeholder="What shows up under the title in Google search results"
              className="mt-1 w-full rounded-md border border-ink-100 px-3 py-1.5 text-sm focus:border-pulse-400 focus:outline-none"
            />
            <p className={`mt-1 text-xs ${descriptionHint.color}`}>{descriptionHint.label}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-ink-100 px-3 py-1.5 text-sm"
          >
            {blogCategories.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <input
            value={newBlogCategoryName}
            onChange={(e) => setNewBlogCategoryName(e.target.value)}
            placeholder="New category name"
            className="rounded-md border border-ink-100 px-3 py-1.5 text-sm"
          />
          <Button size="sm" variant="secondary" onClick={addBlogCategory}>Add category</Button>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as BlogStatus)}
            className="rounded-md border border-ink-100 px-3 py-1.5 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
          <Toggle checked={isSponsored} onChange={setIsSponsored} label="Sponsored" />
          <Toggle checked={isPinned} onChange={setIsPinned} label="Pinned" />
          <Toggle checked={sendAsNewsletter} onChange={setSendAsNewsletter} label="Send as newsletter" />
          <Button size="sm" onClick={savePost}>{editingId ? 'Update post' : 'Save post'}</Button>
          {editingId && (
            <Button size="sm" variant="secondary" onClick={resetForm}>Cancel edit</Button>
          )}
        </div>
        {sendAsNewsletter && status === 'draft' && (
          <p className="text-xs text-flag-600">
            Newsletter only sends when status is Published — saving as Draft now won&apos;t email anyone yet.
          </p>
        )}
        {error && <p className="text-sm text-critical-500">{error}</p>}
      </Card>

      <div className="mt-8 space-y-3">
        {posts.map((post) => (
          <Card key={post.id} className={`p-4 ${editingId === post.id ? 'ring-2 ring-pulse-400' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-ink-800">{post.title}</p>
                  {post.isPinned && <span className="rounded bg-flag-50 px-2 py-0.5 text-xs text-flag-600">Pinned</span>}
                  {post.isSponsored && <span className="rounded bg-pulse-50 px-2 py-0.5 text-xs text-pulse-600">Sponsored</span>}
                  {post.contentFormat === 'html' && (
                    <span className="rounded bg-ink-50 px-2 py-0.5 text-xs text-ink-500">HTML</span>
                  )}
                </div>
                <p className="text-xs text-ink-400">
                  {post.category ?? 'Uncategorized'} · {post.status} · {new Date(post.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="secondary" onClick={() => startEdit(post)}>Edit</Button>
                <Button size="sm" variant="secondary" onClick={() => removePost(post)}>Delete</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
