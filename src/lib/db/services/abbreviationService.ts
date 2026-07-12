import { getDb, generateId, nowIso } from '@/lib/db/client';
import type { MedicalAbbreviation } from '@/types';

interface AbbreviationRow {
  id: string;
  abbreviation: string;
  meaning: string;
  category: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function mapAbbreviation(row: AbbreviationRow): MedicalAbbreviation {
  return {
    id: row.id,
    abbreviation: row.abbreviation,
    meaning: row.meaning,
    category: row.category,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** All abbreviations, alphabetical — used by both the full page and homepage widget (sliced by the caller). */
export async function listAbbreviations(search?: string): Promise<MedicalAbbreviation[]> {
  const db = getDb();
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    const { results } = await db
      .prepare(
        `SELECT * FROM medical_abbreviations
         WHERE abbreviation LIKE ? OR meaning LIKE ?
         ORDER BY abbreviation ASC`
      )
      .bind(term, term)
      .all<AbbreviationRow>();
    return results.map(mapAbbreviation);
  }
  const { results } = await db
    .prepare('SELECT * FROM medical_abbreviations ORDER BY abbreviation ASC')
    .all<AbbreviationRow>();
  return results.map(mapAbbreviation);
}

/** A handful of random entries for the homepage teaser widget. */
export async function listRandomAbbreviations(limit = 5): Promise<MedicalAbbreviation[]> {
  const db = getDb();
  const { results } = await db
    .prepare('SELECT * FROM medical_abbreviations ORDER BY RANDOM() LIMIT ?')
    .bind(limit)
    .all<AbbreviationRow>();
  return results.map(mapAbbreviation);
}

export async function createAbbreviation(
  createdBy: string,
  input: { abbreviation: string; meaning: string; category?: string }
): Promise<MedicalAbbreviation> {
  const db = getDb();
  const id = generateId('abbr');
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO medical_abbreviations (id, abbreviation, meaning, category, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, input.abbreviation.trim(), input.meaning.trim(), input.category?.trim() || null, createdBy, now, now)
    .run();
  return {
    id,
    abbreviation: input.abbreviation.trim(),
    meaning: input.meaning.trim(),
    category: input.category?.trim() || null,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateAbbreviation(
  id: string,
  input: { abbreviation: string; meaning: string; category?: string }
): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      'UPDATE medical_abbreviations SET abbreviation = ?, meaning = ?, category = ?, updated_at = ? WHERE id = ?'
    )
    .bind(input.abbreviation.trim(), input.meaning.trim(), input.category?.trim() || null, nowIso(), id)
    .run();
}

export async function deleteAbbreviation(id: string): Promise<void> {
  const db = getDb();
  await db.prepare('DELETE FROM medical_abbreviations WHERE id = ?').bind(id).run();
}
