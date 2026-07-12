import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { resourceService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ resourceId: string }>;
}

/**
 * This is the only place the real Drive URL is ever revealed to a browser.
 * It re-checks entitlement server-side on every call rather than trusting
 * any client-held state, so a stale "download" button can't leak access.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { resourceId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  const link = await resourceService.resolveDownloadLink(resourceId, user.id);
  if (!link) {
    return NextResponse.json({ error: 'You are not entitled to download this resource yet' }, { status: 403 });
  }

  return NextResponse.redirect(link);
}
