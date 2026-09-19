import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { dailyQuizService } from '@/lib/db';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  return null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const [settings, schedule, history, today] = await Promise.all([
      dailyQuizService.getSettings(),
      dailyQuizService.listSchedule(),
      dailyQuizService.listRecentHistory(14),
      dailyQuizService.getTodaysDailyQuiz(),
    ]);
    return NextResponse.json({
      settings,
      schedule,
      history,
      todayDate: dailyQuizService.getLagosDateString(),
      today: today ? { id: today.id, title: today.title } : null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const hint = /no such table/i.test(msg)
      ? 'Daily quiz tables are missing. Run the 2026-09-daily-quiz-upgrade.sql migration.'
      : msg;
    return NextResponse.json({ error: hint }, { status: 500 });
  }
}

/** Save settings. Body: { poolSize?, noRepeatDays?, skipCompletedForPush? } */
export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const settings = await dailyQuizService.setSettings({
    poolSize: typeof body.poolSize === 'number' ? body.poolSize : undefined,
    noRepeatDays: typeof body.noRepeatDays === 'number' ? body.noRepeatDays : undefined,
    skipCompletedForPush: typeof body.skipCompletedForPush === 'boolean' ? body.skipCompletedForPush : undefined,
  });
  return NextResponse.json({ settings });
}

/** Schedule a quiz. Body: { date: 'YYYY-MM-DD', quizId } */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { date?: string; quizId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.date || !DATE_RE.test(body.date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }
  if (body.date < dailyQuizService.getLagosDateString()) {
    return NextResponse.json({ error: 'Cannot schedule a date in the past' }, { status: 400 });
  }
  if (!body.quizId) return NextResponse.json({ error: 'quizId is required' }, { status: 400 });

  await dailyQuizService.setScheduled(body.date, body.quizId);
  return NextResponse.json({ ok: true });
}

/** Remove a scheduled quiz. Body: { date } */
export async function DELETE(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { date?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.date || !DATE_RE.test(body.date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }
  await dailyQuizService.removeScheduled(body.date);
  return NextResponse.json({ ok: true });
}
