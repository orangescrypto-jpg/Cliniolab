import { NextResponse } from 'next/server';
import { featureFlagService, leaderboardService, siteSettingsService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { quizId } = await params;
  const enabled = await featureFlagService.isFeatureEnabled('leaderboard_per_quiz');
  if (!enabled) return NextResponse.json({ enabled: false, entries: [] });

  const limit = await siteSettingsService.getLeaderboardSize();
  const entries = await leaderboardService.getQuizLeaderboard(quizId, limit);
  return NextResponse.json({ enabled: true, entries });
}
