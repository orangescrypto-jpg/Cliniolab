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
  // The placeholder account that deleted users' content gets reassigned to
  // (see userService.deleteUserCompletely) is an internal implementation
  // detail, not a real person — hide it from the admin list so nobody
  // tries to edit its role or delete it by mistake.
  const visibleUsers = users.filter((u) => u.id !== userService.DELETED_USER_PLACEHOLDER_ID);
  return NextResponse.json({ users: visibleUsers });
}
