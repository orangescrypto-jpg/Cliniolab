import { NextResponse } from 'next/server';
import { dailyQuizService, featureFlagService } from '@/lib/db';
import { listSubscribedUserIds } from '@/lib/db/services/pushSubscriptionService';
import { sendDailyQuizPush } from '@/lib/push/pushNotificationService';
import { isValidCronSecret } from '@/lib/push/cronSecretConfig';

/**
 * Broadcasts the daily quiz reminder to users with a push subscription.
 * Call this from any external scheduler (e.g. a cron-job.org job hitting
 * this URL once a day) with header `x-cron-secret: <secret>`. The secret
 * can be set from the admin Notifications settings page at any time, or
 * via the CRON_SECRET env var as a fallback.
 *
 * Uses the same dailyQuizService pick as the homepage banner, so the push
 * always points at the quiz the banner shows. Users who already took
 * today's quiz are skipped (admin-configurable).
 */
export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || !(await isValidCronSecret(secret))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dailyQuizEnabled = await featureFlagService.isFeatureEnabled('daily_quiz');
  if (!dailyQuizEnabled) return NextResponse.json({ sent: 0, reason: 'daily_quiz feature disabled' });

  const quiz = await dailyQuizService.getTodaysDailyQuiz();
  if (!quiz) return NextResponse.json({ sent: 0, reason: 'no quizzes available' });

  const settings = await dailyQuizService.getSettings();
  const userIds = await listSubscribedUserIds();

  let sent = 0;
  let skipped = 0;
  for (const userId of userIds) {
    if (settings.skipCompletedForPush && (await dailyQuizService.hasUserCompletedQuiz(userId, quiz.id))) {
      skipped++;
      continue;
    }
    await sendDailyQuizPush(userId, quiz.title, `/quizzes/${quiz.id}`).catch(() => {});
    sent++;
  }

  return NextResponse.json({ sent, skipped, quizId: quiz.id });
}
