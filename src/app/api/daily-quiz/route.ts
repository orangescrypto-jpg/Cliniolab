import { NextResponse } from 'next/server';
import { featureFlagService, quizService } from '@/lib/db';

/** Simple deterministic hash so the same date always maps to the same index. */
function hashDateToIndex(dateStr: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  return modulo > 0 ? hash % modulo : 0;
}

export async function GET() {
  const enabled = await featureFlagService.isFeatureEnabled('daily_quiz');
  if (!enabled) return NextResponse.json({ enabled: false, quiz: null });

  const quizzes = await quizService.listLatestPublicQuizzes(100);
  if (quizzes.length === 0) return NextResponse.json({ enabled: true, quiz: null });

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, stable all day
  const index = hashDateToIndex(today, quizzes.length);

  return NextResponse.json({ enabled: true, quiz: quizzes[index] });
}
