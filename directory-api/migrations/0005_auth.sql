ALTER TABLE profiles ADD COLUMN pin_hash TEXT;
ALTER TABLE profiles ADD COLUMN pin_salt TEXT;
ALTER TABLE profiles ADD COLUMN pin_failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN pin_locked_until INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN webauthn_user_id TEXT;

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  device_type TEXT NOT NULL DEFAULT 'singleDevice',
  backed_up INTEGER NOT NULL DEFAULT 0,
  transports TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_profile
ON webauthn_credentials(profile_id);

CREATE TABLE IF NOT EXISTS auth_challenges (
  id TEXT PRIMARY KEY,
  profile_id TEXT,
  kind TEXT NOT NULL CHECK(kind IN ('onepass_register','onepass_login')),
  challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_lookup
ON auth_challenges(profile_id, kind, expires_at);
