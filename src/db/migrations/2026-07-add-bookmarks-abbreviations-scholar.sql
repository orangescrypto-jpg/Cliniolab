-- Migration: bookmarks, medical abbreviations, scholar of the day, blog SEO fields
--
-- Run with:
--   npx wrangler d1 execute cliniolab --remote --file=./src/db/migrations/2026-07-add-bookmarks-abbreviations-scholar.sql

ALTER TABLE blog_posts ADD COLUMN content_format TEXT NOT NULL DEFAULT 'markdown';
ALTER TABLE blog_posts ADD COLUMN seo_title TEXT;
ALTER TABLE blog_posts ADD COLUMN seo_description TEXT;

CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, kind, target_id)
);

CREATE INDEX idx_bookmarks_user ON bookmarks(user_id, kind);

CREATE TABLE medical_abbreviations (
  id TEXT PRIMARY KEY,
  abbreviation TEXT NOT NULL,
  meaning TEXT NOT NULL,
  category TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_abbreviations_term ON medical_abbreviations(abbreviation);

CREATE TABLE scholars_of_the_day (
  id TEXT PRIMARY KEY,
  student_user_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  photo_url TEXT,
  bio TEXT,
  achievement TEXT,
  quote TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_scholars_active ON scholars_of_the_day(is_active, created_at);

INSERT INTO feature_flags (key, enabled, label) VALUES
('jobs_page', 1, 'Jobs Page'),
('scholarships_page', 1, 'Scholarships Page'),
('medical_abbreviations', 1, 'Medical Abbreviations'),
('scholar_of_the_day', 1, 'Scholar of the Day'),
('bookmarks', 1, 'Bookmarks');
