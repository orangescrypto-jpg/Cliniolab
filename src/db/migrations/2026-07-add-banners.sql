-- Migration: add banners table
--
-- schema.sql already has this table for fresh installs. Existing deployed
-- databases need this run once against the live D1 database.
--
-- Run with:
--   npx wrangler d1 execute cliniolab --remote --file=./src/db/migrations/2026-07-add-banners.sql

CREATE TABLE banners (
  id TEXT PRIMARY KEY,
  placement TEXT NOT NULL,        -- 'header' | 'footer'
  title TEXT NOT NULL,
  image_path TEXT NOT NULL,       -- /api/images/banners/uuid.ext
  link_url TEXT,                  -- optional destination when clicked
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Feature flags to let admins turn each banner placement on/off globally,
-- independent of individual banner is_active toggles.
INSERT INTO feature_flags (key, enabled, label) VALUES
('banners_header', 1, 'Header Banner'),
('banners_footer', 1, 'Footer Banner');

-- Related content settings: lets admins toggle and size the "related
-- quizzes" section shown on quiz pages and blog posts.
INSERT INTO site_settings (key, value) VALUES
('related_quizzes_quiz_page', '{"enabled":true,"count":6}'),
('related_quizzes_blog_page', '{"enabled":true,"count":6}');
