import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { pushSubscriptionService } from '@/lib/db';
import type { PushSubscriptionInput } from '@/lib/db/services/pushSubscriptionService';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body: PushSubscriptionInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: 'endpoint and keys.p256dh/auth are required' }, { status: 400 });
  }

  await pushSubscriptionService.saveSubscription(user.id, body);
  return NextResponse.json({ success: true });
}
