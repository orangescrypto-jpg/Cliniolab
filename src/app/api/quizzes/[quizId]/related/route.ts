import { NextResponse } from 'next/server';
import { quizService, siteSettingsService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { quizId } = await params;

  const setting = await siteSettingsService.getRelatedQuizzesQuizPageSetting();
  if (!setting.enabled) return NextResponse.json({ quizzes: [] });

  const quiz = await quizService.getQuizById(quizId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

  const related = await quizService.listRelatedQuizzes(quiz.subcategoryId, quizId, setting.count);
  return NextResponse.json({ quizzes: related });
}
