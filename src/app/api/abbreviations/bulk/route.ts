import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { abbreviationService, featureFlagService } from '@/lib/db';
import { normalizeForDedup } from '@/lib/utils/normalizeText';

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
  //
  // Everything from here down touches the database. Any of these calls can
  // throw (bad connection, a schema mismatch like a missing column, a
  // constraint violation, etc). Without this try/catch, an exception here
  // bubbles up as an unhandled 500 with no JSON body, which breaks the
  // client's `await res.json()` and surfaces as a generic "Network error"
  // even though the request actually reached the server.
  try {
    const abbrevTerms = cleaned.filter((e) => !e.isGlossary).map((e) => e.abbreviation);
    const glossaryTerms = cleaned.filter((e) => e.isGlossary).map((e) => e.abbreviation);
    const [existingAbbrev, existingGlossary] = await Promise.all([
      abbreviationService.findExistingAbbreviationTerms(abbrevTerms, 'abbreviation'),
      abbreviationService.findExistingAbbreviationTerms(glossaryTerms, 'glossary'),
    ]);

    // Normalized (case/punctuation/whitespace-insensitive) keys so that
    // "ACE Inhibitor" and "ace-inhibitor" in the same file are recognized
    // as the same entry, not just an exact lowercase match.
    const seenAbbrev = new Set<string>();
    const seenGlossary = new Set<string>();
    const toCreate: typeof cleaned = [];
    const skipped: { term: string; reason: 'already_in_database' | 'duplicate_in_file' }[] = [];

    for (const entry of cleaned) {
      const normKey = normalizeForDedup(entry.abbreviation);
      const lowerKey = entry.abbreviation.toLowerCase();
      const existing = entry.isGlossary ? existingGlossary : existingAbbrev;
      const seen = entry.isGlossary ? seenGlossary : seenAbbrev;
      if (existing.has(lowerKey)) {
        skipped.push({ term: entry.abbreviation, reason: 'already_in_database' });
        continue;
      }
      if (seen.has(normKey)) {
        skipped.push({ term: entry.abbreviation, reason: 'duplicate_in_file' });
        continue;
      }
      seen.add(normKey);
      toCreate.push(entry);
    }

    const created = toCreate.length > 0 ? await abbreviationService.createAbbreviationsBulk(user.id, toCreate) : [];

    return NextResponse.json({ abbreviations: created, createdCount: created.length, skipped }, { status: 201 });
  } catch (err) {
    console.error('Bulk abbreviation upload failed', err);
    const message = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json(
      { error: `Upload failed while saving to the database: ${message}` },
      { status: 500 }
    );
  }
}
