/**
 * Resend API wrapper. This is the ONLY file allowed to call Resend
 * directly - mirrors the D1/R2 abstraction pattern so the email provider
 * stays swappable and nothing else in the codebase hardcodes provider
 * details.
 */

const RESEND_API_URL = 'https://api.resend.com/emails';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export class EmailSendError extends Error {}

export async function sendEmailViaResend(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!apiKey || !fromAddress) {
    throw new EmailSendError(
      'Missing RESEND_API_KEY or RESEND_FROM_ADDRESS environment variables.'
    );
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new EmailSendError(`Resend API error (${res.status}): ${body}`);
  }
}
