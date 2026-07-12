import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { siteSettingsService } from '@/lib/db';
import type { CookieConsentSetting } from '@/types';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const setting = await siteSettingsService.getCookieConsentSetting();
  return NextResponse.json({ setting });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: CookieConsentSetting;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (
    typeof body.enabled !== 'boolean' ||
    typeof body.message !== 'string' ||
    typeof body.policyLinkText !== 'string' ||
    typeof body.policyUrl !== 'string' ||
    typeof body.acceptButtonText !== 'string' ||
    typeof body.declineButtonText !== 'string'
  ) {
    return NextResponse.json({ error: 'Invalid cookie consent settings payload' }, { status: 400 });
  }

  await siteSettingsService.setCookieConsentSetting(body);
  const setting = await siteSettingsService.getCookieConsentSetting();
  return NextResponse.json({ setting });
}
