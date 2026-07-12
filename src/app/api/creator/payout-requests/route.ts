import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { payoutRequestService, userService } from '@/lib/db';

const MIN_PAYOUT_KOBO = 500000; // ₦5,000 minimum, avoids tiny transfers eating themselves in fees

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const requests = await payoutRequestService.listPayoutRequestsForCreator(user.id);
  return NextResponse.json({ requests, balanceKobo: user.creatorBalanceKobo });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!user.payoutAccountNumber || !user.payoutBankCode) {
    return NextResponse.json(
      { error: 'Add your payout bank details before requesting a payout.' },
      { status: 400 }
    );
  }

  // Re-read fresh balance rather than trusting a stale client value.
  const fresh = await userService.getUserById(user.id);
  const balanceKobo = fresh?.creatorBalanceKobo ?? 0;

  if (balanceKobo < MIN_PAYOUT_KOBO) {
    return NextResponse.json(
      { error: `Minimum payout is ₦${(MIN_PAYOUT_KOBO / 100).toLocaleString('en-NG')}. Your current balance is ₦${(balanceKobo / 100).toLocaleString('en-NG')}.` },
      { status: 400 }
    );
  }

  try {
    const request = await payoutRequestService.createPayoutRequest(user.id, balanceKobo);
    return NextResponse.json({ request }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create payout request' },
      { status: 500 }
    );
  }
}
