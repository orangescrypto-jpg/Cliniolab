import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { payoutRequestService } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can view payout requests' }, { status: 403 });
  }

  const requests = await payoutRequestService.listPendingPayoutRequests();
  return NextResponse.json({ requests });
}
