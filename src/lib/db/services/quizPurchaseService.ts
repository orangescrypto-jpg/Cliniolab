import { getDb, generateId, nowIso } from '@/lib/db/client';
import { getPlatformFeePercent } from '@/lib/db/services/siteSettingsService';
import { adjustCreatorBalance } from '@/lib/db/services/userService';
import type { PurchaseTransactionStatus, QuizPurchase } from '@/types';

interface PurchaseRow {
  id: string;
  quiz_id: string;
  buyer_id: string;
  amount_kobo: number;
  platform_fee_kobo: number;
  creator_earning_kobo: number;
  tx_ref: string;
  flw_transaction_id: string | null;
  status: string;
  created_at: string;
}

function mapPurchase(row: PurchaseRow): QuizPurchase {
  return {
    id: row.id,
    quizId: row.quiz_id,
    buyerId: row.buyer_id,
    amountKobo: row.amount_kobo,
    platformFeeKobo: row.platform_fee_kobo,
    creatorEarningKobo: row.creator_earning_kobo,
    txRef: row.tx_ref,
    flwTransactionId: row.flw_transaction_id,
    status: row.status as PurchaseTransactionStatus,
    createdAt: row.created_at,
  };
}

/**
 * Reads the admin-configured platform commission percentage (editable at
 * /admin/payments) rather than a hardcoded constant, so admin changes
 * apply immediately to new purchases without a code deploy.
 */
export async function calculateSplit(
  amountKobo: number
): Promise<{ platformFeeKobo: number; creatorEarningKobo: number; platformFeePercent: number }> {
  const platformFeePercent = await getPlatformFeePercent();
  const platformFeeKobo = Math.round((amountKobo * platformFeePercent) / 100);
  return { platformFeeKobo, creatorEarningKobo: amountKobo - platformFeeKobo, platformFeePercent };
}

/** Creates a pending purchase record right before redirecting to Flutterwave checkout. */
export async function createPendingPurchase(
  quizId: string,
  buyerId: string,
  amountKobo: number,
  txRef: string
): Promise<QuizPurchase> {
  const db = getDb();
  const { platformFeeKobo, creatorEarningKobo } = await calculateSplit(amountKobo);
  const id = generateId('purchase');
  const createdAt = nowIso();

  await db
    .prepare(
      `INSERT INTO quiz_purchases
        (id, quiz_id, buyer_id, amount_kobo, platform_fee_kobo, creator_earning_kobo, tx_ref, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    )
    .bind(id, quizId, buyerId, amountKobo, platformFeeKobo, creatorEarningKobo, txRef, createdAt)
    .run();

  return {
    id,
    quizId,
    buyerId,
    amountKobo,
    platformFeeKobo,
    creatorEarningKobo,
    txRef,
    flwTransactionId: null,
    status: 'pending',
    createdAt,
  };
}

/**
 * Marks a purchase completed and credits the creator's withdrawable
 * balance — under Model B the platform collects 100% of the payment
 * itself, so the creator's cut has to be credited here explicitly rather
 * than assuming a provider-side split already sent it to their bank.
 */
export async function markPurchaseCompleted(txRef: string, flwTransactionId: string): Promise<void> {
  const db = getDb();
  const purchase = await getPurchaseByTxRef(txRef);
  if (!purchase || purchase.status === 'completed') return; // idempotent - don't double-credit on repeat verify calls

  await db
    .prepare("UPDATE quiz_purchases SET status = 'completed', flw_transaction_id = ? WHERE tx_ref = ?")
    .bind(flwTransactionId, txRef)
    .run();

  const quiz = await db
    .prepare('SELECT creator_id FROM quizzes WHERE id = ?')
    .bind(purchase.quizId)
    .first<{ creator_id: string }>();
  if (quiz) {
    await adjustCreatorBalance(quiz.creator_id, purchase.creatorEarningKobo);
  }
}

export async function markPurchaseFailed(txRef: string): Promise<void> {
  const db = getDb();
  await db.prepare("UPDATE quiz_purchases SET status = 'failed' WHERE tx_ref = ?").bind(txRef).run();
}

export async function getPurchaseByTxRef(txRef: string): Promise<QuizPurchase | null> {
  const db = getDb();
  const row = await db.prepare('SELECT * FROM quiz_purchases WHERE tx_ref = ?').bind(txRef).first<PurchaseRow>();
  return row ? mapPurchase(row) : null;
}

/** Whether this user has a completed purchase for this quiz. */
export async function hasUserPurchased(quizId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const row = await db
    .prepare("SELECT id FROM quiz_purchases WHERE quiz_id = ? AND buyer_id = ? AND status = 'completed'")
    .bind(quizId, userId)
    .first<{ id: string }>();
  return !!row;
}

/** Read-only lifetime earnings total for a creator (completed sales, not their current withdrawable balance). */
export async function getCreatorTotalEarnings(creatorId: string): Promise<number> {
  const db = getDb();
  const row = await db
    .prepare(
      `SELECT SUM(p.creator_earning_kobo) as total
       FROM quiz_purchases p
       JOIN quizzes q ON q.id = p.quiz_id
       WHERE q.creator_id = ? AND p.status = 'completed'`
    )
    .bind(creatorId)
    .first<{ total: number | null }>();
  return row?.total ?? 0;
}

export async function getCreatorEarningsHistory(
  creatorId: string
): Promise<(QuizPurchase & { quizTitle: string })[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT p.*, q.title as quiz_title
       FROM quiz_purchases p
       JOIN quizzes q ON q.id = p.quiz_id
       WHERE q.creator_id = ? AND p.status = 'completed'
       ORDER BY p.created_at DESC`
    )
    .bind(creatorId)
    .all<PurchaseRow & { quiz_title: string }>();
  return results.map((row) => ({ ...mapPurchase(row), quizTitle: row.quiz_title }));
}
