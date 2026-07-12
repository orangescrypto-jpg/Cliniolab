import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { pushSubscriptionService } from '@/lib/db';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body: { endpoint: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.endpoint) {
    return NextResponse.json({ error: 'endpoint is required' }, { status: 400 });
  }

  await pushSubscriptionService.removeSubscription(body.endpoint);
  return NextResponse.json({ success: true });
}
