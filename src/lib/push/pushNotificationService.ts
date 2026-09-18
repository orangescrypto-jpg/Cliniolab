import { pushSubscriptionService, featureFlagService } from '@/lib/db';
import { sendWebPush, type PushPayload } from './webPush';
import { getVapidKeysForSigning, getVapidSetting } from './vapidConfig';
import type { FeatureFlagKey } from '@/types';

// Same convention as src/lib/email/templates/newsletterEmail.ts. Needed
// here because push notification `url` (click-through) and `image`
// (hero banner) both require absolute URLs — a relative path silently
// fails to load as a notification image, and can't reliably resolve on
// click from a native OS notification the way an in-app link does.
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

function absolutize(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * One flag per notification type, same convention as the existing
 * email_* flags. All default enabled (feature_flags defaults enabled
 * when a row is missing, and the migration seeds every row as enabled).
 */
export const PUSH_NOTIFICATION_FLAGS = {
  inactivityNudge: 'push_inactivity_nudge',
  commentReply: 'push_comment_reply',
  dailyQuiz: 'push_daily_quiz',
  blogNewPost: 'push_blog_new_post',
} as const satisfies Record<string, FeatureFlagKey>;

/**
 * Sends a push notification to every subscription a user has (they may
 * be logged in on multiple devices/browsers). No-ops silently if VAPID
 * isn't configured or the user has no subscriptions, so callers never
 * need to guard against push being unset up.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const vapid = await getVapidKeysForSigning();
  if (!vapid) return;

  const subscriptions = await pushSubscriptionService.listSubscriptionsForUser(userId);
  if (!subscriptions || subscriptions.length === 0) return;

  const { subject } = await getVapidSetting();

  const results = await Promise.all(
    subscriptions.map((sub) =>
      sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
        vapid,
        subject
      )
    )
  );

  const expired = results.filter((r) => r.expired);
  await Promise.all(
    expired.map((r) => pushSubscriptionService.removeSubscription(r.endpoint))
  );
}

/**
 * Sends to a user only if the given notification-type flag is enabled.
 * Mirrors the isFeatureEnabled-gated pattern already used by the email
 * senders in emailService.ts.
 */
export async function sendPushToUserIfEnabled(
  userId: string,
  flagKey: FeatureFlagKey,
  payload: PushPayload
): Promise<void> {
  const enabled = await featureFlagService.isFeatureEnabled(flagKey);
  if (!enabled) return;
  await sendPushToUser(userId, payload);
}

export async function sendInactivityNudgePush(userId: string, daysInactive: number): Promise<void> {
  await sendPushToUserIfEnabled(userId, PUSH_NOTIFICATION_FLAGS.inactivityNudge, {
    title: "We've missed you 🩺",
    body:
      daysInactive >= 14
        ? "It's been 2 weeks — jump back in and keep your knowledge sharp."
        : daysInactive >= 7
          ? "A week away already? Come back for a quick quiz."
          : 'A few days off — ready for a quick refresher?',
    url: '/',
  });
}

export async function sendCommentReplyPush(
  userId: string,
  replierName: string,
  contentTitle: string,
  contentPath: string
): Promise<void> {
  await sendPushToUserIfEnabled(userId, PUSH_NOTIFICATION_FLAGS.commentReply, {
    title: `${replierName} replied to your comment`,
    body: contentTitle,
    url: contentPath,
  });
}

export async function sendDailyQuizPush(userId: string, quizTitle: string, quizUrl: string): Promise<void> {
  await sendPushToUserIfEnabled(userId, PUSH_NOTIFICATION_FLAGS.dailyQuiz, {
    title: "Today's quiz is up 🩺",
    body: quizTitle,
    url: quizUrl,
  });
}

/**
 * Broadcasts "new blog post" to every user with a push subscription,
 * same fan-out as the daily-quiz cron (listSubscribedUserIds + one send
 * per user — there's no true broadcast/multicast endpoint in Web Push,
 * each subscription needs its own encrypted payload). Gated by the
 * push_blog_new_post feature flag like every other push type. Returns
 * how many sends were attempted so the caller (the blog publish route)
 * can log/report it; PUSH_NOTIFICATION_FLAGS-gated sends that no-op
 * (flag off, VAPID unset) still count as "attempted" here since the
 * caller only uses this to mark the post as sent, not to retry.
 */
export async function sendBlogPushBroadcast(
  postTitle: string,
  postExcerpt: string,
  postUrl: string,
  coverImageUrl?: string | null
): Promise<number> {
  const userIds = await pushSubscriptionService.listSubscribedUserIds();
  let attempted = 0;
  for (const userId of userIds) {
    await sendPushToUserIfEnabled(userId, PUSH_NOTIFICATION_FLAGS.blogNewPost, {
      title: 'New on the Cliniolab blog',
      body: postExcerpt || postTitle,
      url: absolutize(postUrl),
      image: coverImageUrl ? absolutize(coverImageUrl) : undefined,
    }).catch(() => {});
    attempted++;
  }
  return attempted;
}
