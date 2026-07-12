import { NextResponse } from 'next/server';
import { listBanks } from '@/lib/payments/flutterwaveClient';

export async function GET() {
  try {
    const banks = await listBanks();
    return NextResponse.json({ banks });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load banks' },
      { status: 500 }
    );
  }
}
