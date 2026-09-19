import { NextResponse } from 'next/server';
import { dailyQuizService, featureFlagService } from '@/lib/db';

export async function GET() {
  const enabled = await featureFlagService.isFeatureEnabled('daily_quiz');
  if (!enabled) return NextResponse.json({ enabled: false, quiz: null });

  const quiz = await dailyQuizService.getTodaysDailyQuiz();
  return NextResponse.json({ enabled: true, quiz });
}
