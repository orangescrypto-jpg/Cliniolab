import { NextResponse } from 'next/server';
import { featureFlagService, quizService } from '@/lib/db';
import { listSubscribedUserIds } from '@/lib/db/services/pushSubscriptionService';
import { sendDailyQuizPush } from '@/lib/push/pushNotificationService';
import { isValidCronSecret } from '@/lib/push/cronSecretConfig';

/**
 * Broadcasts the daily quiz reminder to every user with a push
 * subscription. Call this from any external scheduler (e.g. a
 * cron-job.org job hitting this URL once a day) with header
 * `x-cron-secret: <secret>`. The secret can be set from the admin
 * Notifications settings page at any time, or via the CRON_SECRET env
 * var as a fallback.
 */
function hashDateToIndex(dateStr: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  return modulo > 0 ? hash % modulo : 0;
}

export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || !(await isValidCronSecret(secret))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dailyQuizEnabled = await featureFlagService.isFeatureEnabled('daily_quiz');
  if (!dailyQuizEnabled) return NextResponse.json({ sent: 0, reason: 'daily_quiz feature disabled' });

  const quizzes = await quizService.listLatestPublicQuizzes(100);
  if (quizzes.length === 0) return NextResponse.json({ sent: 0, reason: 'no quizzes available' });

  const today = new Date().toISOString().slice(0, 10);
  const index = hashDateToIndex(today, quizzes.length);
  const quiz = quizzes[index];

  const userIds = await listSubscribedUserIds();
  let sent = 0;
  for (const userId of userIds) {
    await sendDailyQuizPush(userId, quiz.title, `/quizzes/${quiz.id}`).catch(() => {});
    sent++;
  }

  return NextResponse.json({ sent, quizId: quiz.id });
}
