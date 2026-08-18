import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { siteSettingsService } from '@/lib/db';

export async function GET() {
  const size = await siteSettingsService.getLeaderboardSize();
  return NextResponse.json({ leaderboardSize: size });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can change the leaderboard size' }, { status: 403 });
  }

  let body: { leaderboardSize: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body.leaderboardSize !== 'number' || body.leaderboardSize < 3 || body.leaderboardSize > 100) {
    return NextResponse.json({ error: 'leaderboardSize must be a number between 3 and 100' }, { status: 400 });
  }

  await siteSettingsService.setLeaderboardSize(body.leaderboardSize);
  return NextResponse.json({ leaderboardSize: body.leaderboardSize });
}
