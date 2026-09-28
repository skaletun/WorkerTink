CREATE TABLE IF NOT EXISTS peer_sessions (
  id TEXT PRIMARY KEY,
  initiator_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  offer_sdp TEXT NOT NULL,
  answer_sdp TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','answered','expired','cancelled')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY(initiator_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE,
  FOREIGN KEY(receiver_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_peer_sessions_receiver_status
ON peer_sessions(receiver_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_peer_sessions_initiator_status
ON peer_sessions(initiator_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_peer_sessions_expiry
ON peer_sessions(expires_at);
