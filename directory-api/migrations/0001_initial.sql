CREATE TABLE IF NOT EXISTS profiles (
  wtink_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  pair_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  FOREIGN KEY(sender_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE,
  FOREIGN KEY(receiver_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profiles_name ON profiles(name);
CREATE INDEX IF NOT EXISTS idx_requests_receiver ON friend_requests(receiver_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_sender ON friend_requests(sender_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_pending_pair ON friend_requests(pair_key) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_requests_id_receiver ON friend_requests(id, receiver_id);
