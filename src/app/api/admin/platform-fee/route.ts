import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { siteSettingsService } from '@/lib/db';

export async function GET() {
  const percent = await siteSettingsService.getPlatformFeePercent();
  return NextResponse.json({ platformFeePercent: percent });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can change the platform fee' }, { status: 403 });
  }

  let body: { platformFeePercent: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body.platformFeePercent !== 'number' || body.platformFeePercent < 0 || body.platformFeePercent > 100) {
    return NextResponse.json({ error: 'platformFeePercent must be a number between 0 and 100' }, { status: 400 });
  }

  await siteSettingsService.setPlatformFeePercent(body.platformFeePercent);
  return NextResponse.json({ platformFeePercent: body.platformFeePercent });
}
