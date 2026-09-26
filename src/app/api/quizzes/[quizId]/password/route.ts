import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { isOwnerOrStaff } from '@/lib/auth/permissions';
import { quizService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

/**
 * Lets a creator change the password on their password-protected private
 * quiz at any time, without regenerating the share link — the link they've
 * already shared keeps working, only the password changes.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { quizId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const quiz = await quizService.getQuizById(quizId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  if (!isOwnerOrStaff(user.role, quiz.creatorId, user.id)) {
    return NextResponse.json({ error: 'Not permitted to modify this quiz' }, { status: 403 });
  }
  if (quiz.visibility !== 'private' || quiz.accessMode !== 'password') {
    return NextResponse.json(
      { error: 'This quiz is not set to password-protected private access' },
      { status: 400 }
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.password || body.password.length < 4) {
    return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
  }

  await quizService.setQuizPassword(quizId, body.password);
  return NextResponse.json({ ok: true });
}
