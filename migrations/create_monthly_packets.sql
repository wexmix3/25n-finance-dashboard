-- Run this once in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/idxuiibqevvbdiluxoth/sql

CREATE TABLE IF NOT EXISTS monthly_packets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location text NOT NULL,
  month text NOT NULL,
  data jsonb NOT NULL,
  generated_at timestamptz DEFAULT now(),
  UNIQUE(location, month)
);

-- Allow service role to read/write
ALTER TABLE monthly_packets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON monthly_packets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON monthly_packets
  FOR SELECT TO authenticated USING (true);
