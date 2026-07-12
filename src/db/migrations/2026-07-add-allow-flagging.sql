-- Migration: add allow_flagging to quizzes
--
-- schema.sql already has this column for fresh installs. Existing deployed
-- databases need this run once against the live D1 database (matches the
-- README's existing pattern for schema changes -- see "Setup" section).
--
-- Run with:
--   npx wrangler d1 execute cliniolab --remote --file=./src/db/migrations/2026-07-add-allow-flagging.sql

ALTER TABLE quizzes ADD COLUMN allow_flagging INTEGER NOT NULL DEFAULT 1;
