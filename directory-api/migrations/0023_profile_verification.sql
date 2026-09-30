-- 2.24.0: profile verification, official status and versioned platform rules acceptance.
ALTER TABLE profiles ADD COLUMN is_official INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN privacy_policy_version TEXT;
ALTER TABLE profiles ADD COLUMN terms_version TEXT;
ALTER TABLE profiles ADD COLUMN rules_accepted_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_profiles_verification ON profiles(is_official,is_verified);

CREATE TABLE IF NOT EXISTS verification_requests (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewed_by TEXT,
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE,
  FOREIGN KEY(reviewed_by) REFERENCES profiles(wtink_id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_pending_profile ON verification_requests(profile_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS idx_verification_status ON verification_requests(status,created_at DESC);
