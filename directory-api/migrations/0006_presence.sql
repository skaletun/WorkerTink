ALTER TABLE profiles ADD COLUMN last_seen INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON profiles(last_seen);
UPDATE profiles SET last_seen = COALESCE(updated_at, created_at, 0) WHERE last_seen = 0;
