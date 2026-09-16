import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { featureFlagService, flashcardPurchaseService, flashcardService } from '@/lib/db';
import { initializeCheckout } from '@/lib/payments/flutterwaveClient';

interface RouteParams {
  params: Promise<{ setId: string }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

export async function POST(_request: Request, { params }: RouteParams) {
  const { setId } = await params;

  const enabled = await featureFlagService.isFeatureEnabled('flashcards');
  if (!enabled) {
    return NextResponse.json({ error: 'Flashcards are currently disabled' }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Login required to purchase' }, { status: 401 });

  const set = await flashcardService.getFlashcardSetById(setId);
  if (!set) return NextResponse.json({ error: 'Flashcard set not found' }, { status: 404 });
  if (set.pricing !== 'paid' || !set.priceKobo) {
    return NextResponse.json({ error: 'This flashcard set is not for sale' }, { status: 400 });
  }

  const alreadyPurchased = await flashcardPurchaseService.hasUserPurchased(setId, user.id);
  if (alreadyPurchased) {
    return NextResponse.json({ error: 'You already own this flashcard set' }, { status: 400 });
  }

  // Same Model B as quiz purchases: platform collects full payment;
  // creator's cut is credited to their balance on completion and
  // withdrawn later via a payout request.
  const txRef = `flashcard_${setId}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  try {
    await flashcardPurchaseService.createPendingPurchase(setId, user.id, set.priceKobo, txRef);

    const checkout = await initializeCheckout({
      email: user.email,
      name: user.displayName ?? user.email,
      amountKobo: set.priceKobo,
      txRef,
      redirectUrl: `${BASE_URL}/flashcards/purchase-success?tx_ref=${txRef}&setId=${setId}`,
      title: set.title,
      meta: { setId, buyerId: user.id },
    });

    return NextResponse.json({ checkoutLink: checkout.link, txRef });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start checkout' },
      { status: 500 }
    );
  }
}
