import { getDb, generateId, nowIso } from '@/lib/db/client';

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Upserts a push subscription for a user (re-subscribing updates the row). */
export async function saveSubscription(
  userId: string,
  sub: PushSubscriptionInput
): Promise<void> {
  const db = getDb();
  const existing = await db
    .prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?')
    .bind(sub.endpoint)
    .first<{ id: string }>();

  if (existing) {
    await db
      .prepare('UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ? WHERE endpoint = ?')
      .bind(userId, sub.keys.p256dh, sub.keys.auth, sub.endpoint)
      .run();
    return;
  }

  const id = generateId('push');
  await db
    .prepare(
      'INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(id, userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, nowIso())
    .run();
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const db = getDb();
  await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
}

export async function listSubscriptionsForUser(userId: string) {
  const db = getDb();
  const { results } = await db
    .prepare('SELECT * FROM push_subscriptions WHERE user_id = ?')
    .bind(userId)
    .all<{ id: string; endpoint: string; p256dh: string; auth: string }>();
  return results;
}
