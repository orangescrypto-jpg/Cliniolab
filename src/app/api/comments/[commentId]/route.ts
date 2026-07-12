import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { commentService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ commentId: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { commentId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const comment = await commentService.getCommentById(commentId);
  if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });

  const canDelete = comment.userId === user.id || user.role === 'admin' || user.role === 'moderator';
  if (!canDelete) {
    return NextResponse.json({ error: 'Not permitted to delete this comment' }, { status: 403 });
  }

  await commentService.deleteComment(commentId);
  return NextResponse.json({ success: true });
}
