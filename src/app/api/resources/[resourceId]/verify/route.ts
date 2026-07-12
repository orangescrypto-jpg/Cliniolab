import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { resourceService } from '@/lib/db';
import { verifyTransaction } from '@/lib/payments/flutterwaveClient';

interface RouteParams {
  params: Promise<{ resourceId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  await params; // resourceId not needed directly - the purchase record carries it
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body: { txRef: string; transactionId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.txRef || !body.transactionId) {
    return NextResponse.json({ error: 'txRef and transactionId are required' }, { status: 400 });
  }

  const purchase = await resourceService.getPurchaseByTxRef(body.txRef);
  if (!purchase) return NextResponse.json({ error: 'Purchase record not found' }, { status: 404 });
  if (purchase.userId !== user.id) {
    return NextResponse.json({ error: 'This purchase does not belong to you' }, { status: 403 });
  }
  if (purchase.status === 'confirmed') {
    return NextResponse.json({ status: 'confirmed' });
  }

  try {
    const result = await verifyTransaction(body.transactionId);
    if (result.status === 'successful' && result.txRef === body.txRef) {
      await resourceService.markFlutterwavePurchaseConfirmed(body.txRef, body.transactionId);
      return NextResponse.json({ status: 'confirmed' });
    }
    return NextResponse.json({ status: 'failed' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
