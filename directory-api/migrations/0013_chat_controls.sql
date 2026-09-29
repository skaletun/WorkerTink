ALTER TABLE social_messages ADD COLUMN edited_at INTEGER;
ALTER TABLE social_messages ADD COLUMN deleted_at INTEGER;
ALTER TABLE social_messages ADD COLUMN reply_to_id TEXT;
ALTER TABLE social_messages ADD COLUMN reply_preview TEXT;
ALTER TABLE social_messages ADD COLUMN note_date TEXT;
ALTER TABLE social_messages ADD COLUMN note_shift TEXT;

CREATE TABLE IF NOT EXISTS social_message_deletions (
  message_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  deleted_at INTEGER NOT NULL,
  PRIMARY KEY(message_id, profile_id),
  FOREIGN KEY(message_id) REFERENCES social_messages(id) ON DELETE CASCADE,
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS chat_mutes (
  profile_id TEXT NOT NULL,
  peer_id TEXT NOT NULL,
  muted_until INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(profile_id, peer_id),
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE,
  FOREIGN KEY(peer_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS blocked_profiles (
  profile_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(profile_id, blocked_id),
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE,
  FOREIGN KEY(blocked_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_message_deletions_profile ON social_message_deletions(profile_id, deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_mutes_profile ON chat_mutes(profile_id, muted_until);
CREATE INDEX IF NOT EXISTS idx_blocked_profile ON blocked_profiles(profile_id, blocked_id);
