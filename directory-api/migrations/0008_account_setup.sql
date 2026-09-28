CREATE TABLE IF NOT EXISTS account_setup (
  wtink_id TEXT PRIMARY KEY,
  setup_ciphertext TEXT NOT NULL,
  setup_iv TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(wtink_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
