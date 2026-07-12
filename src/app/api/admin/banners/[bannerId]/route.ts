import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { bannerService } from '@/lib/db';
import { deleteImageByPath } from '@/lib/storage/r2Client';

interface RouteParams {
  params: Promise<{ bannerId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { bannerId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin/moderator access required' }, { status: 403 });
  }

  let body: {
    title?: string;
    imagePath?: string;
    linkUrl?: string | null;
    isActive?: boolean;
    sortOrder?: number;
    placement?: 'header' | 'footer';
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const banner = await bannerService.updateBanner(bannerId, body);
  if (!banner) return NextResponse.json({ error: 'Banner not found' }, { status: 404 });
  return NextResponse.json({ banner });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { bannerId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin/moderator access required' }, { status: 403 });
  }

  const existing = await bannerService.getBannerById(bannerId);
  if (!existing) return NextResponse.json({ error: 'Banner not found' }, { status: 404 });

  await bannerService.deleteBanner(bannerId);
  // Best-effort cleanup of the R2 object; don't fail the request if this errors.
  try {
    await deleteImageByPath(existing.imagePath);
  } catch {
    // ignore
  }
  return NextResponse.json({ success: true });
}
