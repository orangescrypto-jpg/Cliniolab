import { NextResponse } from 'next/server';
import { featureFlagService, leaderboardService, siteSettingsService } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/currentUser';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { quizId } = await params;
  const enabled = await featureFlagService.isFeatureEnabled('leaderboard_per_quiz');
  if (!enabled) return NextResponse.json({ enabled: false, entries: [] });

  const limit = await siteSettingsService.getLeaderboardSize();
  const entries = await leaderboardService.getQuizLeaderboard(quizId, limit);

  let currentUserRank: number | null = null;
  const user = await getCurrentUser();
  if (user && !entries.some((e) => e.userId === user.id)) {
    currentUserRank = await leaderboardService.getUserQuizRank(quizId, user.id);
  }

  return NextResponse.json({
    enabled: true,
    entries,
    currentUserId: user?.id ?? null,
    currentUserRank,
  });
}
