import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { resourceCategoryService } from '@/lib/db';
import type { ResourceKind } from '@/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kindParam = searchParams.get('kind');
  const kind = kindParam === 'book' || kindParam === 'past_question_pack' ? kindParam : undefined;
  const categories = await resourceCategoryService.listResourceCategories(kind as ResourceKind | undefined);
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin/moderator access required' }, { status: 403 });
  }

  let body: { kind: ResourceKind; name: string; sortOrder?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.name?.trim() || (body.kind !== 'book' && body.kind !== 'past_question_pack')) {
    return NextResponse.json({ error: 'name and a valid kind are required' }, { status: 400 });
  }

  const category = await resourceCategoryService.createResourceCategory({
    kind: body.kind,
    name: body.name.trim(),
    sortOrder: body.sortOrder,
  });
  return NextResponse.json({ category }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin/moderator access required' }, { status: 403 });
  }

  let body: { id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: '"id" is required' }, { status: 400 });
  }

  const result = await resourceCategoryService.deleteResourceCategory(body.id);
  if (!result.deleted) {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }
  return NextResponse.json({ success: true });
}
