import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { userService } from '@/lib/db';
import { resolveAccountNumber } from '@/lib/payments/flutterwaveClient';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json({
    hasPayoutDetails: !!user.payoutAccountNumber,
    bankName: user.payoutBankName,
    accountNumber: user.payoutAccountNumber,
    accountName: user.payoutAccountName,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body: { bankCode: string; bankName: string; accountNumber: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.bankCode || !body.accountNumber) {
    return NextResponse.json({ error: 'bankCode and accountNumber are required' }, { status: 400 });
  }

  try {
    // Verify the account resolves to a real name before saving it, so
    // creators can't accidentally register a mistyped account number.
    // Model B has no subaccount to create - these details are only used
    // later, when admin actions a payout request via the Transfers API.
    const { accountName } = await resolveAccountNumber(body.accountNumber, body.bankCode);

    await userService.savePayoutDetails(user.id, {
      bankCode: body.bankCode,
      bankName: body.bankName,
      accountNumber: body.accountNumber,
      accountName,
    });

    return NextResponse.json({ accountName });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save payout details' },
      { status: 500 }
    );
  }
}
