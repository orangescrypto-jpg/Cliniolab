import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { quizPurchaseService } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const [totalKobo, history] = await Promise.all([
    quizPurchaseService.getCreatorTotalEarnings(user.id),
    quizPurchaseService.getCreatorEarningsHistory(user.id),
  ]);

  return NextResponse.json({ totalKobo, history });
}
