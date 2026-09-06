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
    displayMode?: 'static' | 'slider';
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.displayMode !== undefined && body.displayMode !== 'static' && body.displayMode !== 'slider') {
    return NextResponse.json({ error: 'displayMode must be "static" or "slider"' }, { status: 400 });
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

  // Checked BEFORE the D1 row is deleted, since another banner (e.g. the
  // same graphic reused for both header and footer) might still point at
  // this exact image file — deleting it from R2 in that case would break
  // that other banner's image too.
  const imageStillNeeded = await bannerService.isImagePathUsedByOtherBanner(existing.imagePath, bannerId);

  // D1 row (and its banner_events) is deleted next. If the R2 delete
  // below fails, the banner is already gone from the site and admin list
  // either way — surfacing that failure as a warning (not blocking the
  // delete on it) is more useful than a hard error, since the banner
  // record itself is unrecoverable at that point regardless.
  await bannerService.deleteBanner(bannerId);

  if (imageStillNeeded) {
    return NextResponse.json({ success: true });
  }

  try {
    await deleteImageByPath(existing.imagePath);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        success: true,
        warning: `Banner was deleted, but removing its image from storage failed: ${message}. The image file may still exist in R2 and will need manual cleanup.`,
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ success: true });
}
