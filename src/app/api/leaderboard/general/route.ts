import { NextResponse } from 'next/server';
import { featureFlagService, leaderboardService, siteSettingsService } from '@/lib/db';

export async function GET() {
  const enabled = await featureFlagService.isFeatureEnabled('leaderboard_general');
  if (!enabled) return NextResponse.json({ enabled: false, entries: [] });

  const limit = await siteSettingsService.getLeaderboardSize();
  const entries = await leaderboardService.getGeneralLeaderboard(limit);
  return NextResponse.json({ enabled: true, entries });
}
