import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { resourceService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ resourceId: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { resourceId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin/moderator access required' }, { status: 403 });
  }
  await resourceService.deleteResource(resourceId);
  return NextResponse.json({ success: true });
}
