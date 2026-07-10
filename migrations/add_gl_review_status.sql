-- Run this once in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/idxuiibqevvbdiluxoth/sql
--
-- Adds a reversible "mark GL check reviewed" flag — acknowledges the flags
-- for a period without deleting or altering the underlying variance/control#/
-- journal-entry data. Un-reviewing just clears these columns back to null.

ALTER TABLE monthly_financials
  ADD COLUMN IF NOT EXISTS gl_reviewed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gl_reviewed_by text,
  ADD COLUMN IF NOT EXISTS gl_reviewed_at timestamptz;
