import { NextResponse } from 'next/server';
import { featureFlagService, leaderboardService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { quizId } = await params;
  const enabled = await featureFlagService.isFeatureEnabled('leaderboard_per_quiz');
  if (!enabled) return NextResponse.json({ enabled: false, entries: [] });

  const entries = await leaderboardService.getQuizLeaderboard(quizId);
  return NextResponse.json({ enabled: true, entries });
}
