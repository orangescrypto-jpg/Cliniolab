import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { cmsService, userService } from '@/lib/db';
import { sendNewsletterForPost } from '@/lib/email/emailService';
import type { BlogStatus } from '@/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Number(limitParam) : undefined;
  const category = searchParams.get('category');

  const posts = category
    ? await cmsService.getPostsByCategory(category, limit)
    : await cmsService.listPublishedPosts(limit);

  return NextResponse.json({ posts });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageBlog(user.role)) {
    return NextResponse.json({ error: 'Only admins/moderators can create blog posts' }, { status: 403 });
  }

  let body: {
    title: string;
    slug: string;
    content: string;
    contentFormat?: 'markdown' | 'html';
    excerpt?: string;
    status: BlogStatus;
    category?: string;
    featuredImageUrl?: string;
    seoTitle?: string;
    seoDescription?: string;
    isSponsored?: boolean;
    isPinned?: boolean;
    sendAsNewsletter?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.title || !body.slug || !body.content) {
    return NextResponse.json({ error: 'title, slug, and content are required' }, { status: 400 });
  }

  const post = await cmsService.createPost(user.id, {
    title: body.title,
    slug: body.slug,
    content: body.content,
    contentFormat: body.contentFormat,
    excerpt: body.excerpt,
    status: body.status ?? 'draft',
    category: body.category,
    featuredImageUrl: body.featuredImageUrl,
    seoTitle: body.seoTitle,
    seoDescription: body.seoDescription,
    isSponsored: body.isSponsored,
    isPinned: body.isPinned,
    sendAsNewsletter: body.sendAsNewsletter,
  });

  // Only ever send once, and only for posts actually published (not drafts).
  if (post.sendAsNewsletter && post.status === 'published') {
    const recipients = await userService.adminListUsers();
    const excerpt = post.excerpt || post.content.replace(/[#*_>[\]()!-]/g, '').slice(0, 160) + '…';
    sendNewsletterForPost(post.id, post.title, post.slug, excerpt, recipients)
      .then(() => cmsService.markNewsletterSent(post.id))
      .catch(() => {});
  }

  return NextResponse.json({ post }, { status: 201 });
}
