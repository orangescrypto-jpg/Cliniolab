const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

/** Wraps template body content in a consistent Cliniolab-branded shell. */
export function emailShell(bodyHtml: string, unsubscribeUrl?: string): string {
  return `
  <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; background:#F7F5F0; padding: 32px 0;">
    <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #EEF3F5;">
      <div style="background:#0B1F2E; padding: 24px 32px;">
        <span style="color:#F7F5F0; font-size: 20px; font-weight: 700; font-family: Georgia, serif;">Cliniolab</span>
      </div>
      <div style="padding: 32px;">
        ${bodyHtml}
      </div>
      <div style="padding: 20px 32px; border-top: 1px solid #EEF3F5;">
        <p style="font-size: 12px; color: #87A5B3; margin: 0;">
          © ${new Date().getFullYear()} Cliniolab · <a href="${BASE_URL}" style="color:#2F8F7A;">cliniolab.com</a>
          ${unsubscribeUrl ? ` · <a href="${unsubscribeUrl}" style="color:#87A5B3;">Unsubscribe</a>` : ''}
        </p>
      </div>
    </div>
  </div>`;
}
