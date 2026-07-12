import { emailShell } from './shell';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

export function commentReplyEmail(
  displayName: string,
  replierName: string,
  quizTitle: string,
  quizId: string,
  replyBody: string
): { subject: string; html: string } {
  const body = `
    <h1 style="font-family: Georgia, serif; font-size: 22px; color: #0B1F2E; margin: 0 0 12px;">
      ${replierName} replied to your comment
    </h1>
    <p style="font-size: 14px; color: #1E3A4C; line-height: 1.6;">Hi ${displayName}, on "${quizTitle}":</p>
    <p style="font-size: 14px; color: #1E3A4C; line-height: 1.6; background:#EEF3F5; padding: 12px 16px; border-radius: 8px;">
      ${replyBody}
    </p>
    <a href="${BASE_URL}/quizzes/${quizId}" style="display:inline-block; margin-top: 16px; background:#2F8F7A; color:#fff; padding: 10px 20px; border-radius: 6px; text-decoration:none; font-size: 14px; font-weight:600;">
      View conversation
    </a>
  `;
  return { subject: `${replierName} replied to your comment on Cliniolab`, html: emailShell(body) };
}
