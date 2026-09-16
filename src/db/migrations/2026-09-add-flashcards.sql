-- Standalone Flashcard feature.
--
-- A flashcard_set is the shareable, browsable unit (like a quiz) - it has
-- its own title, category/subcategory, pricing, and creator, and shows up
-- in its own "Flashcards" homepage section/nav item as well as inside each
-- category's block. Individual cards (front/back/explanation) belong to a
-- set the same way questions belong to a quiz.
CREATE TABLE flashcard_sets (
  id TEXT PRIMARY KEY,
  subcategory_id TEXT NOT NULL REFERENCES subcategories(id),
  creator_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'public', -- public | private (mirrors quizzes; private = link-only, not listed)
  status TEXT NOT NULL DEFAULT 'draft',      -- draft | published | archived
  pricing TEXT NOT NULL DEFAULT 'free',      -- 'free' | 'paid'
  price_kobo INTEGER,                        -- price in kobo (NGN minor unit), null if free
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_flashcard_sets_subcategory ON flashcard_sets(subcategory_id);
CREATE INDEX idx_flashcard_sets_visibility ON flashcard_sets(visibility, status);
CREATE INDEX idx_flashcard_sets_creator ON flashcard_sets(creator_id);

CREATE TABLE flashcards (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL REFERENCES flashcard_sets(id),
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  explanation TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_flashcards_set ON flashcards(set_id);

-- One row per successful purchase of a paid flashcard set. Mirrors
-- quiz_purchases exactly (same Flutterwave + platform-fee-split model,
-- same creator_balance_kobo credit on completion) so the existing
-- payment/payout infrastructure can be reused as-is for flashcards.
CREATE TABLE flashcard_purchases (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL REFERENCES flashcard_sets(id),
  buyer_id TEXT NOT NULL REFERENCES users(id),
  amount_kobo INTEGER NOT NULL,
  platform_fee_kobo INTEGER NOT NULL,
  creator_earning_kobo INTEGER NOT NULL,
  tx_ref TEXT UNIQUE NOT NULL,
  flw_transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | completed | failed
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(set_id, buyer_id)
);

CREATE INDEX idx_flashcard_purchases_buyer ON flashcard_purchases(buyer_id);
CREATE INDEX idx_flashcard_purchases_set ON flashcard_purchases(set_id);

-- Flashcards get their own on/off switch, independent of quizzes/exams,
-- matching the existing feature_flags pattern.
INSERT INTO feature_flags (key, enabled, label) VALUES
('flashcards', 1, 'Flashcards');
