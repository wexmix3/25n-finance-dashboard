-- Run this once in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/idxuiibqevvbdiluxoth/sql
--
-- Raw storage for Kube API bookings/reservations (meeting rooms, flex
-- spaces, day passes) -- NOT yet surfaced on the dashboard. Pulled and
-- stored daily starting 2026-08-23 so history accumulates for whenever
-- this gets wired into the UI. See state/worksheets/kube-bookings-storage-2026-08-23.md.

CREATE TABLE IF NOT EXISTS monthly_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location text NOT NULL CHECK (location IN ('Frisco', 'Geneva', 'Waco', 'Schaumburg', 'Uptown')),
  month text NOT NULL,
  data jsonb NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  UNIQUE (location, month)
);

ALTER TABLE monthly_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON monthly_bookings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- No authenticated-read policy yet -- this table isn't read by any
-- dashboard UI. Add one (matching monthly_occupancy's pattern) when it
-- actually gets wired in.
