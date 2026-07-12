import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { resourceService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ purchaseId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { purchaseId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can confirm payments' }, { status: 403 });
  }

  let body: { status: 'confirmed' | 'rejected' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!['confirmed', 'rejected'].includes(body.status)) {
    return NextResponse.json({ error: 'status must be "confirmed" or "rejected"' }, { status: 400 });
  }

  await resourceService.updatePurchaseStatus(purchaseId, user.id, body.status);
  return NextResponse.json({ success: true });
}
