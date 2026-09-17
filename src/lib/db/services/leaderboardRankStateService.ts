import { getDb, nowIso } from '@/lib/db/client';

interface RankStateRow {
  user_id: string;
  last_notified_rank: number;
  updated_at: string;
}

export async function getLastNotifiedRank(userId: string): Promise<number | null> {
  const db = getDb();
  const row = await db
    .prepare('SELECT * FROM leaderboard_rank_state WHERE user_id = ?')
    .bind(userId)
    .first<RankStateRow>();
  return row ? row.last_notified_rank : null;
}

export async function setLastNotifiedRank(userId: string, rank: number): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      `INSERT INTO leaderboard_rank_state (user_id, last_notified_rank, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET last_notified_rank = excluded.last_notified_rank, updated_at = excluded.updated_at`
    )
    .bind(userId, rank, nowIso())
    .run();
}
