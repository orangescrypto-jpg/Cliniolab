import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { userService } from '@/lib/db';
import type { UserRole } from '@/types';

interface RouteParams {
  params: Promise<{ userId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { userId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageUsers(user.role)) {
    return NextResponse.json({ error: 'Only admins can change user roles' }, { status: 403 });
  }

  let body: { role: UserRole };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!['user', 'moderator', 'admin'].includes(body.role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  await userService.setUserRole(userId, body.role);
  const updated = await userService.getUserById(userId);
  return NextResponse.json({ user: updated });
}
