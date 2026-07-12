import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { leaderboardService, userService } from '@/lib/db';
import { sendLeaderboardRecognitionEmail } from '@/lib/email/emailService';

/**
 * Admin manually triggers this whenever they want to recognize the
 * current top performers (no fixed cadence, per product decision).
 * Body: { scope: 'general' } or { scope: 'category', categoryId, label }
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can send leaderboard emails' }, { status: 403 });
  }

  let body: { scope: 'general' | 'category'; categoryId?: string; label?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const entries =
    body.scope === 'general'
      ? await leaderboardService.getGeneralLeaderboard()
      : body.categoryId
      ? await leaderboardService.getCategoryLeaderboard(body.categoryId)
      : [];

  if (entries.length === 0) {
    return NextResponse.json({ error: 'No leaderboard entries to notify' }, { status: 400 });
  }

  const label = body.label ?? (body.scope === 'general' ? 'Top Quiz Takers' : 'Category Leaders');

  let sent = 0;
  for (const entry of entries) {
    const recipient = await userService.getUserById(entry.userId);
    if (!recipient) continue;
    await sendLeaderboardRecognitionEmail(recipient, entry.rank, label).catch(() => {});
    sent++;
  }

  return NextResponse.json({ sent });
}
