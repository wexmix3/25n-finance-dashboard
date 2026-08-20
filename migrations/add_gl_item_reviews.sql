-- Run this once in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/idxuiibqevvbdiluxoth/sql
--
-- Per-item approve/keep-flagged status for GL Check's three flagged-item
-- panels (GL Variance Detail, Control# & Vendor Issues, Journal Entry
-- Review). Christine's 2026-08-19 feedback: "being able to approve or keep
-- flagged each item... these should not be permanent aka you can undo an
-- action if someone accidentally makes a mistake."
--
-- Reversible by construction: only rows for items someone has explicitly
-- approved exist here. Un-approving deletes the row rather than flipping a
-- status column, so "no row" and "flagged/never reviewed" are the same
-- state — nothing to migrate or backfill when this table is empty.

CREATE TABLE IF NOT EXISTS gl_item_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location text NOT NULL,
  month text NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('variance', 'control', 'je')),
  item_key text NOT NULL,
  approved_by text,
  approved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location, month, item_type, item_key)
);

CREATE INDEX IF NOT EXISTS gl_item_reviews_lookup
  ON gl_item_reviews (location, month, item_type);
