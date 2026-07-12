import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { scholarService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ scholarId: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { scholarId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageLearningContent(user.role)) {
    return NextResponse.json({ error: 'Only admins/moderators can change the active scholar' }, { status: 403 });
  }

  await scholarService.setActiveScholar(scholarId);
  return NextResponse.json({ success: true });
}
