import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { siteSettingsService } from '@/lib/db';

export async function GET() {
  const mode = await siteSettingsService.getResourcePaymentMode();
  return NextResponse.json({ mode });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can change the resource payment mode' }, { status: 403 });
  }

  let body: { mode: 'manual' | 'flutterwave' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (body.mode !== 'manual' && body.mode !== 'flutterwave') {
    return NextResponse.json({ error: 'mode must be "manual" or "flutterwave"' }, { status: 400 });
  }

  await siteSettingsService.setResourcePaymentMode(body.mode);
  return NextResponse.json({ mode: body.mode });
}
