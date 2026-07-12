import { NextResponse } from 'next/server';
import { featureFlagService, searchService } from '@/lib/db';

export async function GET(request: Request) {
  const enabled = await featureFlagService.isFeatureEnabled('site_search');
  if (!enabled) return NextResponse.json({ enabled: false, results: null });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ enabled: true, results: { quizzes: [], posts: [], resources: [] } });
  }

  const results = await searchService.searchSite(query);
  return NextResponse.json({ enabled: true, results });
}
