import { getDb, generateId, nowIso } from '@/lib/db/client';
import { getPlatformFeePercent } from '@/lib/db/services/siteSettingsService';
import { adjustCreatorBalance } from '@/lib/db/services/userService';
import type { FlashcardPurchase, PurchaseTransactionStatus } from '@/types';

interface PurchaseRow {
  id: string;
  set_id: string;
  buyer_id: string;
  amount_kobo: number;
  platform_fee_kobo: number;
  creator_earning_kobo: number;
  tx_ref: string;
  flw_transaction_id: string | null;
  status: string;
  created_at: string;
}

function mapPurchase(row: PurchaseRow): FlashcardPurchase {
  return {
    id: row.id,
    setId: row.set_id,
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

/** Same split model as quizPurchaseService.calculateSplit — one shared platform fee setting. */
async function calculateSplit(
  amountKobo: number
): Promise<{ platformFeeKobo: number; creatorEarningKobo: number }> {
  const platformFeePercent = await getPlatformFeePercent();
  const platformFeeKobo = Math.round((amountKobo * platformFeePercent) / 100);
  return { platformFeeKobo, creatorEarningKobo: amountKobo - platformFeeKobo };
}

export async function createPendingPurchase(
  setId: string,
  buyerId: string,
  amountKobo: number,
  txRef: string
): Promise<FlashcardPurchase> {
  const db = getDb();
  const { platformFeeKobo, creatorEarningKobo } = await calculateSplit(amountKobo);
  const id = generateId('fcpurchase');
  const createdAt = nowIso();

  await db
    .prepare(
      `INSERT INTO flashcard_purchases
        (id, set_id, buyer_id, amount_kobo, platform_fee_kobo, creator_earning_kobo, tx_ref, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    )
    .bind(id, setId, buyerId, amountKobo, platformFeeKobo, creatorEarningKobo, txRef, createdAt)
    .run();

  return {
    id,
    setId,
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

export async function markPurchaseCompleted(txRef: string, flwTransactionId: string): Promise<void> {
  const db = getDb();
  const purchase = await getPurchaseByTxRef(txRef);
  if (!purchase || purchase.status === 'completed') return; // idempotent

  await db
    .prepare("UPDATE flashcard_purchases SET status = 'completed', flw_transaction_id = ? WHERE tx_ref = ?")
    .bind(flwTransactionId, txRef)
    .run();

  const set = await db
    .prepare('SELECT creator_id FROM flashcard_sets WHERE id = ?')
    .bind(purchase.setId)
    .first<{ creator_id: string }>();
  if (set) {
    await adjustCreatorBalance(set.creator_id, purchase.creatorEarningKobo);
  }
}

export async function markPurchaseFailed(txRef: string): Promise<void> {
  const db = getDb();
  await db.prepare("UPDATE flashcard_purchases SET status = 'failed' WHERE tx_ref = ?").bind(txRef).run();
}

export async function getPurchaseByTxRef(txRef: string): Promise<FlashcardPurchase | null> {
  const db = getDb();
  const row = await db
    .prepare('SELECT * FROM flashcard_purchases WHERE tx_ref = ?')
    .bind(txRef)
    .first<PurchaseRow>();
  return row ? mapPurchase(row) : null;
}

export async function hasUserPurchased(setId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const row = await db
    .prepare("SELECT id FROM flashcard_purchases WHERE set_id = ? AND buyer_id = ? AND status = 'completed'")
    .bind(setId, userId)
    .first<{ id: string }>();
  return !!row;
}
