import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { bookmarkService, featureFlagService } from '@/lib/db';
import type { BookmarkKind } from '@/types';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get('kind') as BookmarkKind | null;
  const bookmarks = await bookmarkService.listBookmarksForUser(user.id, kind ?? undefined);
  return NextResponse.json({ bookmarks });
}

export async function POST(request: Request) {
  const enabled = await featureFlagService.isFeatureEnabled('bookmarks');
  if (!enabled) return NextResponse.json({ error: 'Bookmarks are currently disabled' }, { status: 403 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  let body: { kind: BookmarkKind; targetId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (body.kind !== 'quiz' && body.kind !== 'resource') {
    return NextResponse.json({ error: 'kind must be "quiz" or "resource"' }, { status: 400 });
  }
  if (!body.targetId) {
    return NextResponse.json({ error: 'targetId is required' }, { status: 400 });
  }

  const result = await bookmarkService.toggleBookmark(user.id, body.kind, body.targetId);
  return NextResponse.json(result);
}
