import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { isOwnerOrStaff } from '@/lib/auth/permissions';
import { quizService } from '@/lib/db';
import type { LinkExpiryOption } from '@/types';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { quizId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const quiz = await quizService.getQuizById(quizId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  if (!isOwnerOrStaff(user.role, quiz.creatorId, user.id)) {
    return NextResponse.json({ error: 'Not permitted to modify this quiz' }, { status: 403 });
  }
  if (quiz.visibility !== 'private') {
    return NextResponse.json({ error: 'Only private quizzes have a share link to regenerate' }, { status: 400 });
  }

  let body: { linkExpiry?: LinkExpiryOption; customExpiryDate?: string } = {};
  try {
    body = await request.json();
  } catch {
    // no body provided is fine; falls back to quiz's existing expiry option
  }

  const result = await quizService.regenerateShareLink(quizId, body.linkExpiry, body.customExpiryDate);
  return NextResponse.json(result);
}
