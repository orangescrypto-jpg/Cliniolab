import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { commentService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ commentId: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { commentId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Login required to like a comment' }, { status: 401 });

  const comment = await commentService.getCommentById(commentId);
  if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });

  const result = await commentService.toggleCommentLike(commentId, user.id);
  return NextResponse.json(result);
}
