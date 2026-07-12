import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { isOwnerOrStaff } from '@/lib/auth/permissions';
import { quizPurchaseService, quizService } from '@/lib/db';
import type { QuizInput } from '@/types';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { quizId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Login required to view quiz questions' }, { status: 401 });
  }

  const quiz = await quizService.getQuizById(quizId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

  // Private quizzes are only reachable through /api/quizzes/shared/[slug],
  // which enforces the share-link expiry. Fetching by raw ID here would
  // otherwise bypass that entirely for anyone who knows/guesses the ID.
  if (quiz.visibility === 'private' && !isOwnerOrStaff(user.role, quiz.creatorId, user.id)) {
    return NextResponse.json(
      { error: 'This quiz is private. Use its share link to access it.' },
      { status: 403 }
    );
  }

  // Paid quizzes require a completed purchase, unless the requester is
  // the creator themselves or staff previewing/moderating it.
  if (quiz.pricing === 'paid' && !isOwnerOrStaff(user.role, quiz.creatorId, user.id)) {
    const purchased = await quizPurchaseService.hasUserPurchased(quizId, user.id);
    if (!purchased) {
      return NextResponse.json(
        { error: 'This is a paid quiz. Purchase it to unlock the questions.', requiresPurchase: true, quiz },
        { status: 402 }
      );
    }
  }

  const questions = await quizService.getQuizQuestions(quizId);
  const isOwnerOrModerator = isOwnerOrStaff(user.role, quiz.creatorId, user.id);

  // Strip correct answers before sending to the client during attempts;
  // they're only needed at grading time (handled server-side in /attempt).
  // Exception: the creator (or staff) editing their own quiz needs the
  // real answers back to pre-fill the edit form.
  const safeQuestions = isOwnerOrModerator
    ? questions
    : questions.map(({ correctAnswer: _correctAnswer, ...rest }) => rest);

  return NextResponse.json({ quiz, questions: safeQuestions });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { quizId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const quiz = await quizService.getQuizById(quizId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

  if (!isOwnerOrStaff(user.role, quiz.creatorId, user.id)) {
    return NextResponse.json({ error: 'Not permitted to edit this quiz' }, { status: 403 });
  }

  let input: QuizInput;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!input.title || !input.subcategoryId || !input.questions?.length) {
    return NextResponse.json(
      { error: 'Title, subcategory, and at least one question are required' },
      { status: 400 }
    );
  }
  if (input.mode === 'exam' && !input.timeLimitSeconds) {
    return NextResponse.json(
      { error: 'Exam mode requires a time limit' },
      { status: 400 }
    );
  }

  try {
    const updated = await quizService.updateQuiz(quizId, input);
    return NextResponse.json({ quiz: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update quiz' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { quizId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const quiz = await quizService.getQuizById(quizId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

  if (!isOwnerOrStaff(user.role, quiz.creatorId, user.id)) {
    return NextResponse.json({ error: 'Not permitted to delete this quiz' }, { status: 403 });
  }

  await quizService.deleteQuiz(quizId);
  return NextResponse.json({ success: true });
}
