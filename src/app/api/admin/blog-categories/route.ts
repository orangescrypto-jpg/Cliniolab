import { NextResponse } from 'next/server';
import { blogCategoryService } from '@/lib/db';

export async function GET() {
  const categories = await blogCategoryService.listBlogCategories();
  return NextResponse.json({ categories });
}
