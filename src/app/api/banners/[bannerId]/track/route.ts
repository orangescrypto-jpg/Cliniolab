import { NextResponse } from 'next/server';
import { bannerService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ bannerId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { bannerId } = await params;

  let body: { eventType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.eventType !== 'impression' && body.eventType !== 'click') {
    return NextResponse.json({ error: 'eventType must be "impression" or "click"' }, { status: 400 });
  }

  // Best-effort: a tracking failure should never surface as an error to
  // the visitor, so this always returns success even if the write fails.
  try {
    await bannerService.recordBannerEvent(bannerId, body.eventType);
  } catch {
    // ignore
  }
  return NextResponse.json({ success: true });
}
