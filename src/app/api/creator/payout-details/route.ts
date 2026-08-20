import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { userService } from '@/lib/db';

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

  let body: { bankName: string; accountNumber: string; accountName: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.bankName?.trim() || !body.accountNumber?.trim() || !body.accountName?.trim()) {
    return NextResponse.json(
      { error: 'bankName, accountNumber, and accountName are required' },
      { status: 400 }
    );
  }

  try {
    // No provider verification here by design - these are entered as free
    // text and saved as-is. Since there's no bankCode, this creator's
    // payout requests can't go through the Flutterwave auto-transfer path
    // (see admin payout-requests route, which requires payoutBankCode) and
    // must be actioned as "Mark paid manually" by admin instead.
    await userService.savePayoutDetails(user.id, {
      bankName: body.bankName.trim(),
      accountNumber: body.accountNumber.trim(),
      accountName: body.accountName.trim(),
    });

    return NextResponse.json({ accountName: body.accountName.trim() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save payout details' },
      { status: 500 }
    );
  }
}
