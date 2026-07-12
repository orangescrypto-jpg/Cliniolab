import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { featureFlagService, siteSettingsService } from '@/lib/db';
import type { HomepageVideoSetting } from '@/types';

export async function GET() {
  const enabled = await featureFlagService.isFeatureEnabled('homepage_video');
  if (!enabled) return NextResponse.json({ enabled: false, video: null });

  const video = await siteSettingsService.getHomepageVideo();
  return NextResponse.json({ enabled: true, video });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: HomepageVideoSetting;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body.youtubeUrl !== 'string' || typeof body.title !== 'string') {
    return NextResponse.json({ error: 'youtubeUrl and title are required' }, { status: 400 });
  }

  await siteSettingsService.setHomepageVideo({
    youtubeUrl: body.youtubeUrl,
    title: body.title,
    description: body.description ?? '',
  });
  const video = await siteSettingsService.getHomepageVideo();
  return NextResponse.json({ video });
}
