import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { listImages } from '@/lib/storage/r2Client';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin/moderator access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const purposeParam = searchParams.get('purpose');
  const cursor = searchParams.get('cursor') ?? undefined;

  if (purposeParam !== null && !['blog', 'resources', 'banners', 'scholars'].includes(purposeParam)) {
    return NextResponse.json({ error: 'purpose must be "blog", "resources", "banners", or "scholars"' }, { status: 400 });
  }
  const purpose = purposeParam as 'blog' | 'resources' | 'banners' | 'scholars' | undefined;

  try {
    const result = await listImages(purpose ?? undefined, cursor);
    return NextResponse.json(result);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('Image list failed:', err);
    return NextResponse.json({ error: `Failed to list images: ${detail}` }, { status: 500 });
  }
}
