ALTER TABLE webauthn_credentials ADD COLUMN device_name TEXT NOT NULL DEFAULT 'Устройство';
CREATE TABLE IF NOT EXISTS chat_media (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  mime TEXT,
  name TEXT,
  iv TEXT NOT NULL,
  size INTEGER NOT NULL,
  chunk_size INTEGER NOT NULL DEFAULT 524288,
  total_chunks INTEGER NOT NULL,
  uploaded_chunks INTEGER NOT NULL DEFAULT 0,
  complete INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY(sender_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE,
  FOREIGN KEY(receiver_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS chat_media_chunks (
  media_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(media_id, chunk_index),
  FOREIGN KEY(media_id) REFERENCES chat_media(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chat_media_pair ON chat_media(sender_id, receiver_id, created_at DESC);
