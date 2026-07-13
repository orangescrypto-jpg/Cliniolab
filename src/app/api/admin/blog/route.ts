import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { cmsService } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageBlog(user.role)) {
    return NextResponse.json({ error: 'Admin/moderator access required' }, { status: 403 });
  }
  const posts = await cmsService.adminListAllPosts();
  return NextResponse.json({ posts });
}
