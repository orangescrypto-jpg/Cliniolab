import { getDb, generateId, nowIso } from '@/lib/db/client';
import type { Certificate } from '@/types';

interface CertificateRow {
  id: string;
  user_id: string;
  quiz_id: string;
  quiz_title: string;
  issued_at: string;
}

function mapCertificate(row: CertificateRow): Certificate {
  return {
    id: row.id,
    userId: row.user_id,
    quizId: row.quiz_id,
    quizTitle: row.quiz_title,
    issuedAt: row.issued_at,
  };
}

/** Issues a certificate if one doesn't already exist for this user+quiz. */
export async function issueCertificateIfEligible(
  userId: string,
  quizId: string,
  passingPercentage = 70,
  achievedPercentage: number
): Promise<Certificate | null> {
  if (achievedPercentage < passingPercentage) return null;

  const db = getDb();
  const existing = await db
    .prepare('SELECT id FROM certificates WHERE user_id = ? AND quiz_id = ?')
    .bind(userId, quizId)
    .first<{ id: string }>();
  if (existing) return null;

  const quiz = await db
    .prepare('SELECT title FROM quizzes WHERE id = ?')
    .bind(quizId)
    .first<{ title: string }>();
  if (!quiz) return null;

  const id = generateId('cert');
  const issuedAt = nowIso();
  await db
    .prepare('INSERT INTO certificates (id, user_id, quiz_id, issued_at) VALUES (?, ?, ?, ?)')
    .bind(id, userId, quizId, issuedAt)
    .run();

  return { id, userId, quizId, quizTitle: quiz.title, issuedAt };
}

export async function listCertificatesForUser(userId: string): Promise<Certificate[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT cert.*, q.title as quiz_title FROM certificates cert
       JOIN quizzes q ON q.id = cert.quiz_id
       WHERE cert.user_id = ?
       ORDER BY cert.issued_at DESC`
    )
    .bind(userId)
    .all<CertificateRow>();
  return results.map(mapCertificate);
}
