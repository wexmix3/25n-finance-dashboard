-- Run this in the Supabase SQL editor for project idxuiibqevvbdiluxoth

-- User profiles with role (admin vs viewer)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
  created_at timestamptz DEFAULT now()
);

-- Auto-create a viewer profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, role) VALUES (new.id, 'viewer');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Financial data per location+month (stores build_statements.py JSON output)
CREATE TABLE IF NOT EXISTS monthly_financials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location text NOT NULL CHECK (location IN ('Frisco', 'Geneva', 'Waco', 'Schaumburg', 'Uptown')),
  month text NOT NULL,
  data jsonb NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  locked boolean NOT NULL DEFAULT false,
  UNIQUE (location, month)
);

-- Occupancy data per location+month (Kube export — shape TBD)
CREATE TABLE IF NOT EXISTS monthly_occupancy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location text NOT NULL CHECK (location IN ('Frisco', 'Geneva', 'Waco', 'Schaumburg', 'Uptown')),
  month text NOT NULL,
  data jsonb NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  locked boolean NOT NULL DEFAULT false,
  UNIQUE (location, month)
);

-- RLS: authenticated users can read both tables
ALTER TABLE monthly_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_occupancy ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read financials"
  ON monthly_financials FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated users can read occupancy"
  ON monthly_occupancy FOR SELECT TO authenticated USING (true);

CREATE POLICY "users can read own profile"
  ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);

-- Service role bypasses RLS for write operations (Python scripts use service key)

-- After running this SQL:
-- 1. Sign Max up via the 25N dashboard login page
-- 2. Run: UPDATE profiles SET role = 'admin' WHERE id = '<Max user id>';
-- 3. Get Max's user ID from: SELECT id, email FROM auth.users;
