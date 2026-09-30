CREATE TABLE IF NOT EXISTS chat_message_pins (
  message_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chat_message_pins_profile ON chat_message_pins(profile_id, created_at DESC);
