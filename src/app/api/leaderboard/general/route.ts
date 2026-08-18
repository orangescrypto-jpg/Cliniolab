import { NextResponse } from 'next/server';
import { featureFlagService, leaderboardService, siteSettingsService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ categoryId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { categoryId } = await params;
  const enabled = await featureFlagService.isFeatureEnabled('leaderboard_category');
  if (!enabled) return NextResponse.json({ enabled: false, entries: [] });

  const limit = await siteSettingsService.getLeaderboardSize();
  const entries = await leaderboardService.getCategoryLeaderboard(categoryId, limit);
  return NextResponse.json({ enabled: true, entries });
}
