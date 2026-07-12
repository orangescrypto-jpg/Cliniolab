import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { scholarService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ scholarId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { scholarId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageLearningContent(user.role)) {
    return NextResponse.json({ error: 'Only admins/moderators can edit a scholar' }, { status: 403 });
  }

  let body: {
    studentUserId?: string;
    name: string;
    photoUrl?: string;
    bio?: string;
    achievement?: string;
    quote?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  await scholarService.updateScholar(scholarId, body);
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { scholarId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageLearningContent(user.role)) {
    return NextResponse.json({ error: 'Only admins/moderators can delete a scholar' }, { status: 403 });
  }

  await scholarService.deleteScholar(scholarId);
  return NextResponse.json({ success: true });
}
