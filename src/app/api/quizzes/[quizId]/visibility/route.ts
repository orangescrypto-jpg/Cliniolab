import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { isOwnerOrStaff } from '@/lib/auth/permissions';
import { quizService } from '@/lib/db';
import type { LinkExpiryOption, QuizVisibility } from '@/types';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { quizId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const quiz = await quizService.getQuizById(quizId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  if (!isOwnerOrStaff(user.role, quiz.creatorId, user.id)) {
    return NextResponse.json({ error: 'Not permitted to modify this quiz' }, { status: 403 });
  }

  let body: { visibility: QuizVisibility; linkExpiry?: LinkExpiryOption; customExpiryDate?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.visibility === 'private' && body.linkExpiry === 'custom' && !body.customExpiryDate) {
    return NextResponse.json(
      { error: 'customExpiryDate is required when linkExpiry is "custom"' },
      { status: 400 }
    );
  }

  await quizService.setQuizVisibility(quizId, body.visibility, body.linkExpiry, body.customExpiryDate);
  const updated = await quizService.getQuizById(quizId);
  return NextResponse.json({ quiz: updated });
}
