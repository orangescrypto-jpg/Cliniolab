import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { featureFlagService, quizPurchaseService, quizService } from '@/lib/db';
import { initializeCheckout } from '@/lib/payments/flutterwaveClient';

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

export async function POST(_request: Request, { params }: RouteParams) {
  const { quizId } = await params;

  const paidQuizzesEnabled = await featureFlagService.isFeatureEnabled('paid_quizzes');
  if (!paidQuizzesEnabled) {
    return NextResponse.json({ error: 'Paid quizzes are currently disabled' }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Login required to purchase' }, { status: 401 });

  const quiz = await quizService.getQuizById(quizId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  if (quiz.pricing !== 'paid' || !quiz.priceKobo) {
    return NextResponse.json({ error: 'This quiz is not for sale' }, { status: 400 });
  }

  const alreadyPurchased = await quizPurchaseService.hasUserPurchased(quizId, user.id);
  if (alreadyPurchased) {
    return NextResponse.json({ error: 'You already own this quiz' }, { status: 400 });
  }

  // Model B: the platform collects the full payment directly - no
  // creator payout setup is required before a quiz can be purchased,
  // since the creator's cut is credited to their balance on completion
  // and withdrawn later via a payout request, not split at checkout time.
  const txRef = `quiz_${quizId}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  try {
    await quizPurchaseService.createPendingPurchase(quizId, user.id, quiz.priceKobo, txRef);

    const checkout = await initializeCheckout({
      email: user.email,
      name: user.displayName ?? user.email,
      amountKobo: quiz.priceKobo,
      txRef,
      redirectUrl: `${BASE_URL}/quizzes/purchase-success?tx_ref=${txRef}&quizId=${quizId}`,
      title: quiz.title,
      meta: { quizId, buyerId: user.id },
    });

    return NextResponse.json({ checkoutLink: checkout.link, txRef });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start checkout' },
      { status: 500 }
    );
  }
}
