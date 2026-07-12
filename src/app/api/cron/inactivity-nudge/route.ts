import { NextResponse } from 'next/server';
import { userService } from '@/lib/db';
import { sendInactivityNudgeEmail } from '@/lib/email/emailService';

/**
 * Called by an external scheduler (Cloudflare Cron Trigger hitting this
 * URL, or any cron service like cron-job.org) rather than a native
 * Workers `scheduled()` handler, since @cloudflare/next-on-pages apps
 * don't expose one directly. Protected by a shared secret header so it
 * can't be triggered by anyone who finds the URL.
 *
 * Sends to users inactive for exactly 3, 7, and 14 days (nudges at a few
 * checkpoints rather than every single day past inactivity).
 */
const NUDGE_DAY_THRESHOLDS = [3, 7, 14];

export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let totalSent = 0;
  for (const days of NUDGE_DAY_THRESHOLDS) {
    const inactiveUsers = await userService.listUsersInactiveForDays(days);
    for (const user of inactiveUsers) {
      await sendInactivityNudgeEmail(user, days).catch(() => {});
      totalSent++;
    }
  }

  return NextResponse.json({ sent: totalSent });
}
