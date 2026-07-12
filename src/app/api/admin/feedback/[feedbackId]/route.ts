import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { feedbackService } from '@/lib/db';
import type { FeedbackStatus } from '@/types';

interface RouteParams {
  params: Promise<{ feedbackId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { feedbackId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin/moderator access required' }, { status: 403 });
  }

  let body: { status: FeedbackStatus };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!['open', 'reviewed', 'resolved'].includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  await feedbackService.updateFeedbackStatus(feedbackId, body.status);
  return NextResponse.json({ success: true });
}
