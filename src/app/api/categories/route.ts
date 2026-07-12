import { NextResponse } from 'next/server';
import { categoryService } from '@/lib/db';

export async function GET() {
  const [categories, subcategories] = await Promise.all([
    categoryService.listCategories(),
    categoryService.listSubcategories(),
  ]);
  return NextResponse.json({ categories, subcategories });
}
