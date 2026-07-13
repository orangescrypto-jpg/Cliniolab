import { sendEmailViaResend } from '@/lib/email/resendClient';
import { welcomeEmail } from '@/lib/email/templates/welcomeEmail';
import { leaderboardRecognitionEmail } from '@/lib/email/templates/leaderboardRecognitionEmail';
import { newsletterEmail } from '@/lib/email/templates/newsletterEmail';
import { quizResultEmail } from '@/lib/email/templates/quizResultEmail';
import { commentReplyEmail } from '@/lib/email/templates/commentReplyEmail';
import { inactivityNudgeEmail } from '@/lib/email/templates/inactivityNudgeEmail';
import { certificateIssuedEmail } from '@/lib/email/templates/certificateIssuedEmail';
import { emailLogService, featureFlagService, userService } from '@/lib/db';
import type { AppUser } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

function unsubscribeUrl(userId: string): string {
  return `${BASE_URL}/dashboard/email-preferences?u=${userId}`;
}

/**
 * Every email send in the app goes through one of these functions rather
 * than calling sendEmailViaResend directly, so the feature-flag check,
 * user-preference check, and email_log write are never accidentally
 * skipped by a call site.
 */

export async function sendWelcomeEmail(user: AppUser): Promise<void> {
  const enabled = await featureFlagService.isFeatureEnabled('email_welcome');
  if (!enabled) return;
  if (await emailLogService.hasEmailBeenSent(user.id, 'welcome')) return;

  const { subject, html } = welcomeEmail(user.displayName ?? user.email);
  await sendEmailViaResend({ to: user.email, subject, html });
  await emailLogService.logEmailSent(user.id, 'welcome');
}

export async function sendLeaderboardRecognitionEmail(
  user: AppUser,
  rank: number,
  leaderboardLabel: string
): Promise<void> {
  const enabled = await featureFlagService.isFeatureEnabled('email_leaderboard_recognition');
  if (!enabled) return;

  const { subject, html } = leaderboardRecognitionEmail(
    user.displayName ?? user.email,
    rank,
    leaderboardLabel
  );
  await sendEmailViaResend({ to: user.email, subject, html });
  await emailLogService.logEmailSent(user.id, 'leaderboard_recognition');
}

export async function sendNewsletterForPost(
  postId: string,
  postTitle: string,
  postSlug: string,
  excerpt: string,
  recipients: AppUser[]
): Promise<{ sent: number; failed: number }> {
  const enabled = await featureFlagService.isFeatureEnabled('email_newsletter');
  if (!enabled) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  for (const user of recipients) {
    if (!user.emailNewsletter) continue;
    try {
      const { subject, html } = newsletterEmail(postTitle, postSlug, excerpt, unsubscribeUrl(user.id));
      await sendEmailViaResend({ to: user.email, subject, html });
      await emailLogService.logEmailSent(user.id, 'newsletter', postId);
      sent++;
    } catch {
      failed++; // one recipient failing shouldn't abort the whole batch
    }
  }
  return { sent, failed };
}

export async function sendQuizResultEmail(
  user: AppUser,
  quizTitle: string,
  percentage: number
): Promise<void> {
  const enabled = await featureFlagService.isFeatureEnabled('email_quiz_results');
  if (!enabled || !user.emailQuizResults) return;

  const { subject, html } = quizResultEmail(
    user.displayName ?? user.email,
    quizTitle,
    percentage,
    unsubscribeUrl(user.id)
  );
  await sendEmailViaResend({ to: user.email, subject, html });
  await emailLogService.logEmailSent(user.id, 'quiz_result');
}

export async function sendCommentReplyEmail(
  recipientUserId: string,
  replierName: string,
  contentTitle: string,
  contentPath: string,
  replyBody: string
): Promise<void> {
  const enabled = await featureFlagService.isFeatureEnabled('email_comment_reply');
  if (!enabled) return;

  const recipient = await userService.getUserById(recipientUserId);
  if (!recipient) return;

  const { subject, html } = commentReplyEmail(
    recipient.displayName ?? recipient.email,
    replierName,
    contentTitle,
    contentPath,
    replyBody
  );
  await sendEmailViaResend({ to: recipient.email, subject, html });
  await emailLogService.logEmailSent(recipient.id, 'comment_reply');
}

export async function sendCertificateIssuedEmail(
  user: AppUser,
  quizTitle: string,
  certificateId: string
): Promise<void> {
  const enabled = await featureFlagService.isFeatureEnabled('email_certificate_issued');
  if (!enabled) return;
  if (await emailLogService.hasEmailBeenSent(user.id, 'certificate_issued', certificateId)) return;

  const { subject, html } = certificateIssuedEmail(
    user.displayName ?? user.email,
    quizTitle,
    certificateId,
    unsubscribeUrl(user.id)
  );
  await sendEmailViaResend({ to: user.email, subject, html });
  await emailLogService.logEmailSent(user.id, 'certificate_issued', certificateId);
}

export async function sendInactivityNudgeEmail(user: AppUser, daysInactive: number): Promise<void> {
  const enabled = await featureFlagService.isFeatureEnabled('email_inactivity_nudge');
  if (!enabled) return;

  const { subject, html } = inactivityNudgeEmail(
    user.displayName ?? user.email,
    daysInactive,
    unsubscribeUrl(user.id)
  );
  await sendEmailViaResend({ to: user.email, subject, html });
  await emailLogService.logEmailSent(user.id, 'inactivity_nudge');
}
