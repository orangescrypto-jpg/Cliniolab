import { NextResponse } from 'next/server';
import { featureFlagService, leaderboardService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ categoryId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { categoryId } = await params;
  const enabled = await featureFlagService.isFeatureEnabled('leaderboard_category');
  if (!enabled) return NextResponse.json({ enabled: false, entries: [] });

  const entries = await leaderboardService.getCategoryLeaderboard(categoryId);
  return NextResponse.json({ enabled: true, entries });
}
