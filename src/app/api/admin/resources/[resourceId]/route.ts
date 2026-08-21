import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { resourceService } from '@/lib/db';

interface RouteParams {
  params: Promise<{ resourceId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { resourceId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin/moderator access required' }, { status: 403 });
  }
  const resource = await resourceService.getResourceById(resourceId);
  if (!resource) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const driveLink = await resourceService.getDriveLinkForManagement(resourceId);
  return NextResponse.json({ resource: { ...resource, driveLink } });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { resourceId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin/moderator access required' }, { status: 403 });
  }

  const body = await request.json();

  if (body.title !== undefined && !String(body.title).trim()) {
    return NextResponse.json({ error: 'Title cannot be empty.' }, { status: 400 });
  }
  if (body.driveLink !== undefined && !String(body.driveLink).trim()) {
    return NextResponse.json({ error: 'Google Drive link cannot be empty.' }, { status: 400 });
  }
  if (body.pricing === 'paid' && body.priceKobo !== undefined && body.priceKobo <= 0) {
    return NextResponse.json({ error: 'Set a price for a paid resource.' }, { status: 400 });
  }

  const updated = await resourceService.updateResource(resourceId, {
    kind: body.kind,
    title: body.title,
    description: body.description !== undefined ? body.description || null : undefined,
    coverImageUrl: body.coverImageUrl !== undefined ? body.coverImageUrl || null : undefined,
    institutionName: body.institutionName !== undefined ? body.institutionName || null : undefined,
    subjectTag: body.subjectTag !== undefined ? body.subjectTag || null : undefined,
    pricing: body.pricing,
    priceKobo: body.priceKobo,
    driveLink: body.driveLink,
  });

  if (!updated) return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
  return NextResponse.json({ resource: updated });
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
