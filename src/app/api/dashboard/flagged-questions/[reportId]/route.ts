import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { quizService, reportService } from '@/lib/db';
import type { ReportStatus } from '@/types';

interface RouteParams {
  params: Promise<{ reportId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { reportId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const report = await reportService.getReportById(reportId);
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

  const quiz = await quizService.getQuizById(report.quizId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

  // Creators can only act on reports for their own quizzes; staff can act
  // on any report (mirrors the same pattern used for quiz edit/delete).
  const isOwner = quiz.creatorId === user.id;
  if (!isOwner && !permissions.canManageLearningContent(user.role)) {
    return NextResponse.json({ error: 'Not permitted to update this report' }, { status: 403 });
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
