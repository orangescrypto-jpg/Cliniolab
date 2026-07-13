import { NextResponse } from 'next/server';
import { blogCategoryService } from '@/lib/db';

// Public read-only endpoint. The admin blog editor's subcategory
// dropdown fetches from here whenever the chosen top-level category
// changes. Creating/reusing a subcategory happens via POST
// /api/admin/blog-categories (admin/moderator only).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get('categoryId');
  if (!categoryId) {
    return NextResponse.json({ error: 'categoryId is required' }, { status: 400 });
  }

  const subcategories = await blogCategoryService.listBlogSubcategories(categoryId);
  return NextResponse.json({ subcategories });
}
