import { emailShell } from './shell';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

export function inactivityNudgeEmail(
  displayName: string,
  daysInactive: number,
  unsubscribeUrl: string
): { subject: string; html: string } {
  const body = `
    <h1 style="font-family: Georgia, serif; font-size: 22px; color: #0B1F2E; margin: 0 0 12px;">
      We miss you, ${displayName}
    </h1>
    <p style="font-size: 14px; color: #1E3A4C; line-height: 1.6;">
      It's been ${daysInactive} days since your last practice session. A few minutes today keeps
      your streak building and your knowledge sharp.
    </p>
    <a href="${BASE_URL}/categories" style="display:inline-block; margin-top: 16px; background:#2F8F7A; color:#fff; padding: 10px 20px; border-radius: 6px; text-decoration:none; font-size: 14px; font-weight:600;">
      Practice now
    </a>
  `;
  return { subject: 'Keep your streak alive on Cliniolab', html: emailShell(body, unsubscribeUrl) };
}
