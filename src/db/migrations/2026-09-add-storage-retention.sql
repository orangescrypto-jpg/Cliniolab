-- Storage retention: keeps D1 (5GB free tier) from growing without bound.
--
-- Apply with:
--   npx wrangler d1 execute cliniolab --remote --file=src/db/migrations/2026-09-add-storage-retention.sql
--
-- Safe to run once. Re-running fails on CREATE TABLE (no IF NOT EXISTS on
-- purpose, matching the other migrations, so a double-apply is loud).

-- 1. banner_stats ------------------------------------------------------
-- Replaces the per-event banner_events log with one row per banner per
-- day. At 2 banner slots x ~2 pageviews/user/day, the event log grows by
-- millions of rows a year; this grows by 365 rows per banner per year and
-- still answers every question the admin UI asks (total impressions,
-- clicks, CTR, and by-date-range reports for sponsors).
CREATE TABLE banner_stats (
  banner_id TEXT NOT NULL REFERENCES banners(id),
  day TEXT NOT NULL,                        -- YYYY-MM-DD (UTC)
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (banner_id, day)
);

-- Backfill from the existing event log so admin totals do not reset to
-- zero. substr(created_at, 1, 10) works because created_at is an ISO
-- timestamp (nowIso()).
INSERT INTO banner_stats (banner_id, day, impressions, clicks)
SELECT
  banner_id,
  substr(created_at, 1, 10),
  SUM(CASE WHEN event_type = 'impression' THEN 1 ELSE 0 END),
  SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END)
FROM banner_events
GROUP BY banner_id, substr(created_at, 1, 10);

-- banner_events is intentionally NOT dropped here. Once you have confirmed
-- the admin banner stats look right, reclaim the space with:
--   DROP TABLE banner_events;
--   DROP INDEX IF EXISTS idx_banner_events_banner;

-- 2. Retention indexes -------------------------------------------------
-- The retention cron deletes by age. Without these, every purge scans the
-- whole table and burns D1's daily rows-read budget.
CREATE INDEX idx_attempts_started_at ON quiz_attempts(started_at);
CREATE INDEX idx_email_log_sent_at ON email_log(sent_at);
CREATE INDEX idx_attempt_answers_attempt ON attempt_answers(attempt_id);

-- 3. Composite index for the dashboard history query ------------------
-- getAttemptsByUser: WHERE user_id = ? ORDER BY started_at DESC.
-- Lets SQLite read rows already sorted instead of sorting per request.
CREATE INDEX idx_attempts_user_started ON quiz_attempts(user_id, started_at);
