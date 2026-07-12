-- Migration: add banner_events table (impression/click tracking)
--
-- schema.sql already has this table for fresh installs. Existing deployed
-- databases need this run once against the live D1 database.
--
-- Run with:
--   npx wrangler d1 execute cliniolab --remote --file=./src/db/migrations/2026-07-add-banner-events.sql

CREATE TABLE banner_events (
  id TEXT PRIMARY KEY,
  banner_id TEXT NOT NULL REFERENCES banners(id),
  event_type TEXT NOT NULL,       -- 'impression' | 'click'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_banner_events_banner ON banner_events(banner_id, event_type);
