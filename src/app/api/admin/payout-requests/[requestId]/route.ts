import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { payoutRequestService, userService } from '@/lib/db';
import { initiateTransfer } from '@/lib/payments/flutterwaveClient';

interface RouteParams {
  params: Promise<{ requestId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { requestId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can action payout requests' }, { status: 403 });
  }

  const payoutRequest = await payoutRequestService.getPayoutRequestById(requestId);
  if (!payoutRequest) return NextResponse.json({ error: 'Payout request not found' }, { status: 404 });
  if (payoutRequest.status !== 'pending') {
    return NextResponse.json({ error: `This request is already ${payoutRequest.status}` }, { status: 400 });
  }

  let body: { method: 'flutterwave' | 'manual'; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (body.method !== 'flutterwave' && body.method !== 'manual') {
    return NextResponse.json({ error: 'method must be "flutterwave" or "manual"' }, { status: 400 });
  }

  if (body.method === 'manual') {
    await payoutRequestService.markPayoutPaidManually(requestId, user.id, body.note);
    return NextResponse.json({ success: true, method: 'manual' });
  }

  // Flutterwave-automatic branch: actually send the money now.
  const creator = await userService.getUserById(payoutRequest.creatorId);
  if (!creator?.payoutBankCode || !creator.payoutAccountNumber) {
    return NextResponse.json(
      { error: 'This creator has no payout bank details on file - use manual instead, or ask them to add bank details.' },
      { status: 400 }
    );
  }

  try {
    const transfer = await initiateTransfer({
      accountBankCode: creator.payoutBankCode,
      accountNumber: creator.payoutAccountNumber,
      amountKobo: payoutRequest.amountKobo,
      narration: `Cliniolab creator payout`,
      reference: `payout_${requestId}`,
    });
    await payoutRequestService.markPayoutProcessingViaFlutterwave(requestId, user.id, String(transfer.transferId));
    return NextResponse.json({ success: true, method: 'flutterwave', transferId: transfer.transferId });
  } catch (err) {
    // Refund the creator's balance since the transfer never went out.
    await payoutRequestService.markPayoutFailed(
      requestId,
      user.id,
      err instanceof Error ? err.message : 'Flutterwave transfer failed'
    );
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to initiate transfer' },
      { status: 500 }
    );
  }
}
