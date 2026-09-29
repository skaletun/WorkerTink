-- 2.22.0: usernames, group chats, corporate invite-only channels, richer push/media.
ALTER TABLE profiles ADD COLUMN username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique ON profiles(username) WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS chat_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_id TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(owner_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS chat_group_members (
  group_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at INTEGER NOT NULL,
  muted_until INTEGER,
  PRIMARY KEY(group_id, profile_id),
  FOREIGN KEY(group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS chat_group_keys (
  group_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  iv TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(group_id, profile_id),
  FOREIGN KEY(group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS chat_group_messages (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',
  mime TEXT,
  name TEXT,
  created_at INTEGER NOT NULL,
  read_at INTEGER,
  edited_at INTEGER,
  deleted_at INTEGER,
  reply_to_id TEXT,
  reply_preview TEXT,
  FOREIGN KEY(group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
  FOREIGN KEY(sender_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chat_group_messages_group ON chat_group_messages(group_id, created_at ASC);
CREATE TABLE IF NOT EXISTS chat_group_message_deletions (
  message_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  deleted_at INTEGER NOT NULL,
  PRIMARY KEY(message_id, profile_id),
  FOREIGN KEY(message_id) REFERENCES chat_group_messages(id) ON DELETE CASCADE,
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS company_channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(owner_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS company_channel_roles (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  name TEXT NOT NULL,
  permissions TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY(channel_id) REFERENCES company_channels(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS company_channel_members (
  channel_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY(channel_id, profile_id),
  FOREIGN KEY(channel_id) REFERENCES company_channels(id) ON DELETE CASCADE,
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE,
  FOREIGN KEY(role_id) REFERENCES company_channel_roles(id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS company_channel_invites (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  invited_profile_id TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  responded_at INTEGER,
  FOREIGN KEY(channel_id) REFERENCES company_channels(id) ON DELETE CASCADE,
  FOREIGN KEY(invited_profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE,
  FOREIGN KEY(invited_by) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_company_invites_profile ON company_channel_invites(invited_profile_id, status, created_at DESC);
CREATE TABLE IF NOT EXISTS company_channel_posts (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(channel_id) REFERENCES company_channels(id) ON DELETE CASCADE,
  FOREIGN KEY(author_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_company_channel_posts ON company_channel_posts(channel_id, created_at DESC);

ALTER TABLE push_subscriptions ADD COLUMN device_name TEXT;
ALTER TABLE push_subscriptions ADD COLUMN platform TEXT;
ALTER TABLE push_subscriptions ADD COLUMN last_seen INTEGER;
CREATE TABLE IF NOT EXISTS notification_preferences (
  profile_id TEXT PRIMARY KEY,
  preferences TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
ALTER TABLE chat_media ADD COLUMN group_id TEXT;
CREATE INDEX IF NOT EXISTS idx_chat_media_group ON chat_media(group_id, created_at DESC);
