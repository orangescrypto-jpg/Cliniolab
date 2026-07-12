import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { quizPurchaseService } from '@/lib/db';
import { verifyTransaction } from '@/lib/payments/flutterwaveClient';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Flutterwave appends both tx_ref and transaction_id to the redirect
  // URL; transaction_id is what the verify endpoint actually needs, but
  // tx_ref is what we cross-check the amount/purchase record against so a
  // tampered or unrelated transaction_id can't be used to unlock content.
  let body: { txRef: string; transactionId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.txRef || !body.transactionId) {
    return NextResponse.json({ error: 'txRef and transactionId are required' }, { status: 400 });
  }

  const purchase = await quizPurchaseService.getPurchaseByTxRef(body.txRef);
  if (!purchase) return NextResponse.json({ error: 'Purchase record not found' }, { status: 404 });
  if (purchase.buyerId !== user.id) {
    return NextResponse.json({ error: 'This purchase does not belong to you' }, { status: 403 });
  }

  if (purchase.status === 'completed') {
    return NextResponse.json({ status: 'completed' });
  }

  try {
    const result = await verifyTransaction(body.transactionId);
    const amountMatches = result.amountKobo === purchase.amountKobo;
    if (result.status === 'successful' && result.txRef === body.txRef && amountMatches) {
      await quizPurchaseService.markPurchaseCompleted(body.txRef, body.transactionId);
      return NextResponse.json({ status: 'completed' });
    }

    await quizPurchaseService.markPurchaseFailed(body.txRef);
    return NextResponse.json({ status: 'failed' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
