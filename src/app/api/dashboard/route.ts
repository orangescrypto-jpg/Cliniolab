import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { certificateService, featureFlagService, userService } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const certificatesEnabled = await featureFlagService.isFeatureEnabled('certificates');

  const [stats, certificates] = await Promise.all([
    userService.getUserDashboardStats(user.id),
    certificatesEnabled ? certificateService.listCertificatesForUser(user.id) : Promise.resolve([]),
  ]);

  return NextResponse.json({
    stats: certificatesEnabled ? stats : { ...stats, certificatesEarned: 0 },
    certificates,
  });
}
