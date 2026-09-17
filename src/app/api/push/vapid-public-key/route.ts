import { NextResponse } from 'next/server';
import { getVapidPublicKey } from '@/lib/push/vapidConfig';

/**
 * VAPID public keys are, by design, safe to expose to any client — the
 * push subscribe flow needs this to call pushManager.subscribe(). Only
 * the private key (never returned by this route) can sign notifications.
 */
export async function GET() {
  const publicKey = await getVapidPublicKey();
  return NextResponse.json({ publicKey });
}
