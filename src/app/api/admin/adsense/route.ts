import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { siteSettingsService } from '@/lib/db';
import type { AdSenseSetting } from '@/lib/db/services/siteSettingsService';

export async function GET() {
  const setting = await siteSettingsService.getAdSenseSetting();
  return NextResponse.json(setting);
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: AdSenseSetting;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body.enabled !== 'boolean' || typeof body.clientId !== 'string') {
    return NextResponse.json({ error: 'enabled and clientId are required' }, { status: 400 });
  }

  await siteSettingsService.setAdSenseSetting({ enabled: body.enabled, clientId: body.clientId.trim() });
  const setting = await siteSettingsService.getAdSenseSetting();
  return NextResponse.json(setting);
}
