import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { certificateService, userService } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const [stats, certificates] = await Promise.all([
    userService.getUserDashboardStats(user.id),
    certificateService.listCertificatesForUser(user.id),
  ]);

  return NextResponse.json({ stats, certificates });
}
