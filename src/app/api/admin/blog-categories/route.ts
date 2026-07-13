import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { blogCategoryService } from '@/lib/db';

export async function GET() {
  const categories = await blogCategoryService.listBlogCategories();
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageBlog(user.role)) {
    return NextResponse.json({ error: 'Only admins/moderators can manage blog subcategories' }, { status: 403 });
  }

  let body: { blogCategoryId?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.blogCategoryId || !body.name?.trim()) {
    return NextResponse.json({ error: 'blogCategoryId and name are required' }, { status: 400 });
  }

  const subcategory = await blogCategoryService.getOrCreateBlogSubcategory(
    body.blogCategoryId,
    body.name.trim()
  );
  return NextResponse.json({ subcategory }, { status: 201 });
}
