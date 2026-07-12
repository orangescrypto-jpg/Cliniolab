-- Migration: add comment_reactions table (likes on comments)
--
-- schema.sql already has this table for fresh installs. Existing deployed
-- databases need this run once against the live D1 database (matches the
-- README's existing pattern for schema changes -- see "Setup" section).
--
-- Run with:
--   npx wrangler d1 execute cliniolab --remote --file=./src/db/migrations/2026-07-add-comment-reactions.sql

CREATE TABLE comment_reactions (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL REFERENCES comments(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (comment_id, user_id)
);

CREATE INDEX idx_comment_reactions_comment ON comment_reactions(comment_id);
