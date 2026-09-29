ALTER TABLE social_messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text';
ALTER TABLE social_messages ADD COLUMN mime TEXT;
ALTER TABLE social_messages ADD COLUMN name TEXT;
CREATE TABLE IF NOT EXISTS chat_device_keys (
  profile_id TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS qr_login_sessions (
  id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  pc_public_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  profile_id TEXT,
  transfer_iv TEXT,
  transfer_data TEXT,
  transfer_peer_public_key TEXT,
  token_hash TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  login_token TEXT,
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_qr_login_expiry ON qr_login_sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_profile ON auth_sessions(profile_id, expires_at);
