import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { featureFlagService } from '@/lib/db';
import type { FeatureFlagKey } from '@/types';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const flags = await featureFlagService.listFeatureFlags();
  return NextResponse.json({ flags });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageFeatureFlags(user.role)) {
    return NextResponse.json({ error: 'Only admins can change feature flags' }, { status: 403 });
  }

  let body: { key: FeatureFlagKey; enabled: boolean; label?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.key || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'key and enabled are required' }, { status: 400 });
  }

  await featureFlagService.setFeatureFlag(body.key, body.enabled, body.label);
  const flags = await featureFlagService.listFeatureFlags();
  return NextResponse.json({ flags });
}
