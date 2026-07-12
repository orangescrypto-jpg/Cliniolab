import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { reportService } from '@/lib/db';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Login required to report a question' }, { status: 401 });

  let body: { questionId: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.questionId) {
    return NextResponse.json({ error: 'questionId is required' }, { status: 400 });
  }

  const report = await reportService.reportQuestion(user.id, body.questionId, body.reason);
  return NextResponse.json({ report }, { status: 201 });
}
