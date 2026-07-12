-- Migration: switch payments from Paystack to Flutterwave (Model B)
--
-- IMPORTANT: SQLite/D1 cannot drop or rename columns in older engine
-- versions without a full table rebuild. Rather than risk data loss on a
-- live database, this migration ADDS the new columns the app now uses and
-- leaves the old Paystack columns in place, inert. The application code no
-- longer reads paystack_subaccount_code or paystack_reference anywhere.
-- If you want them physically removed later, that's a separate, careful
-- table-rebuild migration - not required for the app to work correctly.
--
-- Run with:
--   npx wrangler d1 execute cliniolab --remote --file=./src/db/migrations/2026-07-switch-to-flutterwave.sql

ALTER TABLE users ADD COLUMN creator_balance_kobo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN payout_bank_code TEXT;

ALTER TABLE quiz_purchases ADD COLUMN tx_ref TEXT;
ALTER TABLE quiz_purchases ADD COLUMN flw_transaction_id TEXT;
-- Backfill tx_ref from the old paystack_reference so existing completed
-- purchases keep a valid, unique reference under the new column name.
UPDATE quiz_purchases SET tx_ref = paystack_reference WHERE tx_ref IS NULL;
CREATE UNIQUE INDEX idx_quiz_purchases_tx_ref ON quiz_purchases(tx_ref);

CREATE TABLE payout_requests (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES users(id),
  amount_kobo INTEGER NOT NULL,
  method TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  flw_transfer_id TEXT,
  admin_note TEXT,
  actioned_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  actioned_at TEXT
);

CREATE INDEX idx_payout_requests_creator ON payout_requests(creator_id);
CREATE INDEX idx_payout_requests_status ON payout_requests(status);

ALTER TABLE resource_purchases ADD COLUMN tx_ref TEXT;
ALTER TABLE resource_purchases ADD COLUMN flw_transaction_id TEXT;

-- Site-wide setting controlling how resource purchases are collected.
-- Read/written via siteSettingsService, same pattern as platform_fee_percent.
INSERT INTO site_settings (key, value) VALUES
('resource_payment_mode', '"manual"');
