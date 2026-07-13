import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { cmsService } from '@/lib/db';
import type { BlogContentFormat, BlogStatus } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageBlog(user.role)) {
    return NextResponse.json({ error: 'Admin/moderator access required' }, { status: 403 });
  }

  const { id } = await params;
  const existing = await cmsService.getPostById(id);
  if (!existing) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  let body: Partial<{
    title: string;
    slug: string;
    content: string;
    contentFormat: BlogContentFormat;
    excerpt: string;
    status: BlogStatus;
    category: string;
    featuredImageUrl: string;
    seoTitle: string;
    seoDescription: string;
    isSponsored: boolean;
    isPinned: boolean;
  }>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  await cmsService.updatePost(id, body);
  const updated = await cmsService.getPostById(id);
  return NextResponse.json({ post: updated });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageBlog(user.role)) {
    return NextResponse.json({ error: 'Admin/moderator access required' }, { status: 403 });
  }

  const { id } = await params;
  await cmsService.deletePost(id);
  return NextResponse.json({ ok: true });
}
