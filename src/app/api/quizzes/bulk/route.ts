import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { quizService } from '@/lib/db';
import type { QuizInput } from '@/types';

/**
 * Accepts { quizzes: QuizInput[] } and creates them all, allowing a user
 * to upload many quizzes at once (e.g. from a spreadsheet/JSON export).
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canCreateQuizzes(user.role)) {
    return NextResponse.json({ error: 'Not permitted to create quizzes' }, { status: 403 });
  }

  let body: { quizzes: QuizInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.quizzes) || body.quizzes.length === 0) {
    return NextResponse.json({ error: '"quizzes" must be a non-empty array' }, { status: 400 });
  }

  for (const [index, quiz] of body.quizzes.entries()) {
    if (!quiz.title || !quiz.subcategoryId || !quiz.questions?.length) {
      return NextResponse.json(
        { error: `Quiz at index ${index} is missing title, subcategoryId, or questions` },
        { status: 400 }
      );
    }
  }

  try {
    const created = await quizService.bulkCreateQuizzes(user.id, body.quizzes);
    return NextResponse.json({ quizzes: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bulk upload failed' },
      { status: 500 }
    );
  }
}
