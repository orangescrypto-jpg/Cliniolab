import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { abbreviationService, featureFlagService } from '@/lib/db';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageLearningContent(user.role)) {
    return NextResponse.json({ error: 'Only admins/moderators can add abbreviations' }, { status: 403 });
  }

  const enabled = await featureFlagService.isFeatureEnabled('medical_abbreviations');
  if (!enabled) {
    return NextResponse.json({ error: 'Medical abbreviations are currently disabled' }, { status: 403 });
  }

  let body: { entries?: { abbreviation: string; meaning: string; category?: string; isGlossary?: boolean }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const entries = body.entries ?? [];
  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: 'entries must be a non-empty array' }, { status: 400 });
  }

  const cleaned = entries
    .map((e) => ({
      abbreviation: (e.abbreviation ?? '').trim(),
      meaning: (e.meaning ?? '').trim(),
      category: e.category?.trim() || undefined,
      isGlossary: !!e.isGlossary,
    }))
    .filter((e) => e.abbreviation && e.meaning);

  if (cleaned.length === 0) {
    return NextResponse.json({ error: 'No valid rows (term and meaning are required)' }, { status: 400 });
  }

  // Duplicate checks are scoped separately for abbreviations vs glossary
  // terms, so the same word can exist once as a short abbreviation and
  // once as a full glossary entry without colliding.
  const abbrevTerms = cleaned.filter((e) => !e.isGlossary).map((e) => e.abbreviation);
  const glossaryTerms = cleaned.filter((e) => e.isGlossary).map((e) => e.abbreviation);
  const [existingAbbrev, existingGlossary] = await Promise.all([
    abbreviationService.findExistingAbbreviationTerms(abbrevTerms, 'abbreviation'),
    abbreviationService.findExistingAbbreviationTerms(glossaryTerms, 'glossary'),
  ]);

  const seenAbbrev = new Set<string>();
  const seenGlossary = new Set<string>();
  const toCreate: typeof cleaned = [];
  const skipped: string[] = [];

  for (const entry of cleaned) {
    const key = entry.abbreviation.toLowerCase();
    const existing = entry.isGlossary ? existingGlossary : existingAbbrev;
    const seen = entry.isGlossary ? seenGlossary : seenAbbrev;
    if (existing.has(key) || seen.has(key)) {
      skipped.push(entry.abbreviation);
      continue;
    }
    seen.add(key);
    toCreate.push(entry);
  }

  const created = toCreate.length > 0 ? await abbreviationService.createAbbreviationsBulk(user.id, toCreate) : [];

  return NextResponse.json({ abbreviations: created, createdCount: created.length, skipped }, { status: 201 });
}
