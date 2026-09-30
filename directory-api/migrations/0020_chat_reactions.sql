CREATE TABLE IF NOT EXISTS chat_message_reactions (
  message_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(message_id, profile_id),
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chat_message_reactions_message ON chat_message_reactions(message_id);

CREATE TABLE IF NOT EXISTS chat_group_message_reactions (
  message_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(message_id, profile_id),
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chat_group_message_reactions_message ON chat_group_message_reactions(message_id);
