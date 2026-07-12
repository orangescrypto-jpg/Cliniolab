import { emailShell } from './shell';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

export function certificateIssuedEmail(
  displayName: string,
  quizTitle: string,
  certificateId: string,
  unsubscribeUrl: string
): { subject: string; html: string } {
  const certUrl = `${BASE_URL}/certificates/${certificateId}`;
  const body = `
    <h1 style="font-family: Georgia, serif; font-size: 22px; color: #0B1F2E; margin: 0 0 12px;">
      You earned a certificate 🎉
    </h1>
    <p style="font-size: 14px; color: #1E3A4C; line-height: 1.6;">
      Congratulations, ${displayName}. You've earned a certificate for completing
      <strong>${quizTitle}</strong>. You can view or print it any time from the link below.
    </p>
    <a href="${certUrl}" style="display:inline-block; margin-top: 16px; background:#2F8F7A; color:#fff; padding: 10px 20px; border-radius: 6px; text-decoration:none; font-size: 14px; font-weight:600;">
      View certificate
    </a>
  `;
  return {
    subject: `Your certificate for ${quizTitle}`,
    html: emailShell(body, unsubscribeUrl),
  };
}
