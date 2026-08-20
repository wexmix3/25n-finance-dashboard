-- Run this once in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/idxuiibqevvbdiluxoth/sql
--
-- Free-text notes on GL Check's three flagged-item panels (GL Variance
-- Detail, Control# & Vendor Issues, Journal Entry Review). Separate from
-- gl_item_reviews on purpose — a note and an approval are independent
-- facts (you might leave a note on something you're not approving).
--
-- Reversible by construction, same pattern as gl_item_reviews: clearing a
-- note to empty deletes the row rather than storing an empty string, so
-- "no row" and "no note" are the same state.

CREATE TABLE IF NOT EXISTS gl_item_notes (
  location text NOT NULL,
  month text NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('variance', 'control', 'je')),
  item_key text NOT NULL,
  note text NOT NULL,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location, month, item_type, item_key)
);
