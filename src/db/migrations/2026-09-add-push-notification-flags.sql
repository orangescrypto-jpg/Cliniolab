-- Migration: per-notification-type toggles for push notifications
--
-- Mirrors the existing email_* feature flag convention. Each row
-- controls one push notification type from the admin Feature Flags
-- page. enabled = 1 (on) by default for all three, per product
-- requirement that new notification types ship on.
--
-- Run with:
--   npx wrangler d1 execute cliniolab --remote --file=./src/db/migrations/2026-09-add-push-notification-flags.sql

INSERT INTO feature_flags (key, enabled, label) VALUES
  ('push_inactivity_nudge', 1, 'Push: Inactivity nudge'),
  ('push_comment_reply', 1, 'Push: Comment reply'),
  ('push_daily_quiz', 1, 'Push: Daily quiz reminder')
ON CONFLICT(key) DO NOTHING;
