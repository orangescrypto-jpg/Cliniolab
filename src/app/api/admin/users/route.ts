import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { userService } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageUsers(user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const users = await userService.adminListUsers();
  return NextResponse.json({ users });
}
