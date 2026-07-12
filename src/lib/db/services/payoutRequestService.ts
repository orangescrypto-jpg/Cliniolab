import { getDb, generateId, nowIso } from '@/lib/db/client';
import { adjustCreatorBalance } from '@/lib/db/services/userService';
import type { PayoutMethod, PayoutRequest, PayoutStatus } from '@/types';

interface PayoutRequestRow {
  id: string;
  creator_id: string;
  amount_kobo: number;
  method: string | null;
  status: string;
  flw_transfer_id: string | null;
  admin_note: string | null;
  actioned_by: string | null;
  created_at: string;
  actioned_at: string | null;
}

function mapPayoutRequest(row: PayoutRequestRow): PayoutRequest {
  return {
    id: row.id,
    creatorId: row.creator_id,
    amountKobo: row.amount_kobo,
    method: row.method as PayoutMethod | null,
    status: row.status as PayoutStatus,
    flwTransferId: row.flw_transfer_id,
    adminNote: row.admin_note,
    actionedBy: row.actioned_by,
    createdAt: row.created_at,
    actionedAt: row.actioned_at,
  };
}

/**
 * Creates a payout request and immediately debits the creator's balance,
 * so they can't request the same money twice while a request is pending.
 * If the request later fails, the balance is refunded (see markFailed).
 */
export async function createPayoutRequest(creatorId: string, amountKobo: number): Promise<PayoutRequest> {
  const db = getDb();
  const id = generateId('payout');
  const createdAt = nowIso();

  await db
    .prepare(
      `INSERT INTO payout_requests (id, creator_id, amount_kobo, status, created_at)
       VALUES (?, ?, ?, 'pending', ?)`
    )
    .bind(id, creatorId, amountKobo, createdAt)
    .run();

  await adjustCreatorBalance(creatorId, -amountKobo);

  return {
    id,
    creatorId,
    amountKobo,
    method: null,
    status: 'pending',
    flwTransferId: null,
    adminNote: null,
    actionedBy: null,
    createdAt,
    actionedAt: null,
  };
}

export async function getPayoutRequestById(id: string): Promise<PayoutRequest | null> {
  const db = getDb();
  const row = await db.prepare('SELECT * FROM payout_requests WHERE id = ?').bind(id).first<PayoutRequestRow>();
  return row ? mapPayoutRequest(row) : null;
}

/** Looks up a payout request by Flutterwave's transfer id — used by the webhook to resolve transfer.completed events. */
export async function getPayoutRequestByTransferId(flwTransferId: string): Promise<PayoutRequest | null> {
  const db = getDb();
  const row = await db
    .prepare('SELECT * FROM payout_requests WHERE flw_transfer_id = ?')
    .bind(flwTransferId)
    .first<PayoutRequestRow>();
  return row ? mapPayoutRequest(row) : null;
}

/** All pending requests, for the admin payout queue. */
export async function listPendingPayoutRequests(): Promise<(PayoutRequest & { creatorName: string; creatorEmail: string })[]> {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT p.*, u.display_name as creator_name, u.email as creator_email
       FROM payout_requests p
       JOIN users u ON u.id = p.creator_id
       WHERE p.status = 'pending'
       ORDER BY p.created_at ASC`
    )
    .all<PayoutRequestRow & { creator_name: string | null; creator_email: string }>();
  return results.map((row) => ({
    ...mapPayoutRequest(row),
    creatorName: row.creator_name ?? 'Anonymous',
    creatorEmail: row.creator_email,
  }));
}

/** A creator's own payout request history, for their earnings dashboard. */
export async function listPayoutRequestsForCreator(creatorId: string): Promise<PayoutRequest[]> {
  const db = getDb();
  const { results } = await db
    .prepare('SELECT * FROM payout_requests WHERE creator_id = ? ORDER BY created_at DESC')
    .bind(creatorId)
    .all<PayoutRequestRow>();
  return results.map(mapPayoutRequest);
}

/** Admin marks a request as being processed via an automatic Flutterwave transfer. */
export async function markPayoutProcessingViaFlutterwave(
  id: string,
  adminId: string,
  flwTransferId: string
): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      `UPDATE payout_requests SET method = 'flutterwave', status = 'processing', flw_transfer_id = ?, actioned_by = ?, actioned_at = ?
       WHERE id = ?`
    )
    .bind(flwTransferId, adminId, nowIso(), id)
    .run();
}

/** Admin marks a request as paid manually (already sent the money outside the system). */
export async function markPayoutPaidManually(id: string, adminId: string, note?: string): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      `UPDATE payout_requests SET method = 'manual', status = 'paid', admin_note = ?, actioned_by = ?, actioned_at = ?
       WHERE id = ?`
    )
    .bind(note ?? null, adminId, nowIso(), id)
    .run();
}

/** Called once a Flutterwave transfer is confirmed successful (e.g. via a status check). */
export async function markPayoutPaid(id: string): Promise<void> {
  const db = getDb();
  const request = await getPayoutRequestById(id);
  if (!request || request.status === 'paid') return; // already paid - no-op on duplicate webhook delivery
  await db.prepare("UPDATE payout_requests SET status = 'paid' WHERE id = ?").bind(id).run();
}

/**
 * A payout attempt failed — refunds the amount back onto the creator's
 * balance so it isn't lost, and records why for admin visibility.
 */
export async function markPayoutFailed(id: string, adminId: string | null, reason: string): Promise<void> {
  const db = getDb();
  const request = await getPayoutRequestById(id);
  if (!request || request.status === 'failed') return; // already failed - don't refund twice

  await db
    .prepare(
      `UPDATE payout_requests SET status = 'failed', admin_note = ?, actioned_by = ?, actioned_at = ?
       WHERE id = ?`
    )
    .bind(reason, adminId, nowIso(), id)
    .run();

  await adjustCreatorBalance(request.creatorId, request.amountKobo);
}
