import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { categoryService } from '@/lib/db';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: {
    type: 'category' | 'subcategory';
    name: string;
    slug: string;
    description?: string;
    sortOrder?: number;
    categoryId?: string; // required when type === 'subcategory'
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.name || !body.slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
  }

  if (body.type === 'subcategory') {
    if (!body.categoryId) {
      return NextResponse.json({ error: 'categoryId is required for subcategories' }, { status: 400 });
    }
    const subcategory = await categoryService.createSubcategory({
      categoryId: body.categoryId,
      name: body.name,
      slug: body.slug,
      description: body.description,
      sortOrder: body.sortOrder,
    });
    return NextResponse.json({ subcategory }, { status: 201 });
  }

  const category = await categoryService.createCategory({
    name: body.name,
    slug: body.slug,
    description: body.description,
    sortOrder: body.sortOrder,
  });
  return NextResponse.json({ category }, { status: 201 });
}
