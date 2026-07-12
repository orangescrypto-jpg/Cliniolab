import { NextResponse } from 'next/server';
import { blogCategoryService } from '@/lib/db';

// Public read-only endpoint. The admin blog editor's category dropdown
// fetches from here (not /api/admin/blog-categories, which requires
// admin/moderator auth and is used only for creating new categories).
export async function GET() {
  const categories = await blogCategoryService.listBlogCategories();
  return NextResponse.json({ categories });
}
