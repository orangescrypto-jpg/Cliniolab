import { NextResponse } from 'next/server';
import { featureFlagService, leaderboardService } from '@/lib/db';

export async function GET() {
  const enabled = await featureFlagService.isFeatureEnabled('leaderboard_general');
  if (!enabled) return NextResponse.json({ enabled: false, entries: [] });

  const entries = await leaderboardService.getGeneralLeaderboard();
  return NextResponse.json({ enabled: true, entries });
}
