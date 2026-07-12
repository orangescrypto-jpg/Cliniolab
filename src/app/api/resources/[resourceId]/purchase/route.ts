import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { resourceService, siteSettingsService } from '@/lib/db';
import { initializeCheckout } from '@/lib/payments/flutterwaveClient';

interface RouteParams {
  params: Promise<{ resourceId: string }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

export async function POST(request: Request, { params }: RouteParams) {
  const { resourceId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  const mode = await siteSettingsService.getResourcePaymentMode();

  if (mode === 'flutterwave') {
    const resource = await resourceService.getResourceById(resourceId);
    if (!resource) return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    if (resource.pricing !== 'paid' || !resource.priceKobo) {
      return NextResponse.json({ error: 'This resource is not for sale' }, { status: 400 });
    }

    const txRef = `resource_${resourceId}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    try {
      await resourceService.createPendingFlutterwavePurchase(resourceId, user.id, txRef);
      const checkout = await initializeCheckout({
        email: user.email,
        name: user.displayName ?? user.email,
        amountKobo: resource.priceKobo,
        txRef,
        redirectUrl: `${BASE_URL}/resources/purchase-success?tx_ref=${txRef}&resourceId=${resourceId}`,
        title: resource.title,
        meta: { resourceId, buyerId: user.id },
      });
      return NextResponse.json({ checkoutLink: checkout.link, txRef });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to start checkout' },
        { status: 500 }
      );
    }
  }

  // Manual mode: existing proof-upload flow, unchanged.
  let body: { proofImageUrl: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.proofImageUrl) {
    return NextResponse.json({ error: 'proofImageUrl is required' }, { status: 400 });
  }

  const purchase = await resourceService.submitPurchaseProof(resourceId, user.id, body.proofImageUrl);
  return NextResponse.json({ purchase }, { status: 201 });
}
