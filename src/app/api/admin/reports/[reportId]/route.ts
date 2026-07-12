import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { reportService } from '@/lib/db';
import type { ReportStatus } from '@/types';

interface RouteParams {
  params: Promise<{ reportId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { reportId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: { status: ReportStatus };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!['open', 'reviewed', 'dismissed'].includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  await reportService.updateReportStatus(reportId, body.status);
  return NextResponse.json({ success: true });
}
