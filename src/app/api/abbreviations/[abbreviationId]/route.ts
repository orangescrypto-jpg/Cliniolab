import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { abbreviationService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ abbreviationId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { abbreviationId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageLearningContent(user.role)) {
    return NextResponse.json({ error: 'Only admins/moderators can edit abbreviations' }, { status: 403 });
  }

  let body: { abbreviation: string; meaning: string; category?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.abbreviation?.trim() || !body.meaning?.trim()) {
    return NextResponse.json({ error: 'abbreviation and meaning are required' }, { status: 400 });
  }

  await abbreviationService.updateAbbreviation(abbreviationId, body);
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { abbreviationId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageLearningContent(user.role)) {
    return NextResponse.json({ error: 'Only admins/moderators can delete abbreviations' }, { status: 403 });
  }

  await abbreviationService.deleteAbbreviation(abbreviationId);
  return NextResponse.json({ success: true });
}
