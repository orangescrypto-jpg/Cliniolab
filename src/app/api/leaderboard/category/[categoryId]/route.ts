import { NextResponse } from 'next/server';
import { featureFlagService, leaderboardService, siteSettingsService } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/currentUser';

interface RouteParams {
  params: Promise<{ categoryId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { categoryId } = await params;
  const enabled = await featureFlagService.isFeatureEnabled('leaderboard_category');
  if (!enabled) return NextResponse.json({ enabled: false, entries: [] });

  const limit = await siteSettingsService.getLeaderboardSize();
  const entries = await leaderboardService.getCategoryLeaderboard(categoryId, limit);

  let currentUserRank: number | null = null;
  const user = await getCurrentUser();
  if (user && !entries.some((e) => e.userId === user.id)) {
    currentUserRank = await leaderboardService.getUserCategoryRank(categoryId, user.id);
  }

  return NextResponse.json({
    enabled: true,
    entries,
    currentUserId: user?.id ?? null,
    currentUserRank,
  });
}
