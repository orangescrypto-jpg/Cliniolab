import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { categoryService } from '@/lib/db';

interface ResolveRequest {
  // Each pair is looked up by (case-insensitive) name; any that don't
  // exist yet are created. Category and subcategory are resolved together
  // since a subcategory only makes sense scoped to its parent category.
  pairs: { category: string; subcategory: string }[];
}

/**
 * Used by bulk quiz upload to turn a spreadsheet's freeform
 * category/subcategory text into real IDs, creating rows that don't exist
 * yet rather than forcing the uploader to stop, go create them by hand,
 * and re-upload. Reuses getOrCreateCategory/getOrCreateSubcategory, which
 * match by slug first -- so re-running the same upload, or two different
 * uploads that both mention "Cardiology", never create duplicates.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canCreateQuizzes(user.role)) {
    return NextResponse.json({ error: 'Not permitted to create quizzes' }, { status: 403 });
  }

  let body: ResolveRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.pairs) || body.pairs.length === 0) {
    return NextResponse.json({ error: '"pairs" must be a non-empty array' }, { status: 400 });
  }

  // Dedupe identical (category, subcategory) pairs up front (case-
  // insensitive) so a spreadsheet with 40 rows for the same quiz doesn't
  // fire 40 redundant lookups -- one resolve per distinct pair is enough.
  const seen = new Map<string, { category: string; subcategory: string }>();
  for (const p of body.pairs) {
    const category = (p.category ?? '').trim();
    const subcategory = (p.subcategory ?? '').trim();
    if (!category || !subcategory) continue;
    seen.set(`${category.toLowerCase()}\u0000${subcategory.toLowerCase()}`, { category, subcategory });
  }

  const resolved: { category: string; subcategory: string; subcategoryId: string; created: boolean }[] = [];

  for (const { category, subcategory } of seen.values()) {
    const categoryRow = await categoryService.getOrCreateCategory(category);
    const existingSubcategories = await categoryService.listSubcategories(categoryRow.id);
    const alreadyExisted = existingSubcategories.some(
      (s) => s.name.toLowerCase() === subcategory.toLowerCase()
    );
    const subcategoryRow = await categoryService.getOrCreateSubcategory(categoryRow.id, subcategory);
    resolved.push({
      category,
      subcategory,
      subcategoryId: subcategoryRow.id,
      created: !alreadyExisted,
    });
  }

  return NextResponse.json({ resolved });
}
