import { NextResponse } from 'next/server';
import { featureFlagService, leaderboardService, siteSettingsService } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/currentUser';

export async function GET() {
  const enabled = await featureFlagService.isFeatureEnabled('leaderboard_general');
  if (!enabled) return NextResponse.json({ enabled: false, entries: [] });

  const limit = await siteSettingsService.getLeaderboardSize();
  const entries = await leaderboardService.getGeneralLeaderboard(limit);

  // Only look up the viewer's own rank when they're signed in AND not
  // already visible in the returned top-N - avoids a wasted query on the
  // (much more common) anonymous-visitor and "already ranked" cases.
  let currentUserRank: number | null = null;
  const user = await getCurrentUser();
  if (user && !entries.some((e) => e.userId === user.id)) {
    currentUserRank = await leaderboardService.getUserGeneralRank(user.id);
  }

  return NextResponse.json({
    enabled: true,
    entries,
    currentUserId: user?.id ?? null,
    currentUserRank,
  });
}
