CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(author_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_social_posts_created ON social_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_author ON social_posts(author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS social_post_likes (
  post_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(post_id, profile_id),
  FOREIGN KEY(post_id) REFERENCES social_posts(id) ON DELETE CASCADE,
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_social_likes_post ON social_post_likes(post_id);

CREATE TABLE IF NOT EXISTS social_post_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(post_id) REFERENCES social_posts(id) ON DELETE CASCADE,
  FOREIGN KEY(author_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_social_comments_post ON social_post_comments(post_id, created_at ASC);

CREATE TABLE IF NOT EXISTS social_notifications (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  actor_id TEXT,
  kind TEXT NOT NULL,
  entity_id TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT './?tab=social',
  read_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE,
  FOREIGN KEY(actor_id) REFERENCES profiles(wtink_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_social_notifications_profile ON social_notifications(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_notifications_unread ON social_notifications(profile_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS social_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at INTEGER,
  FOREIGN KEY(sender_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE,
  FOREIGN KEY(receiver_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_social_messages_pair ON social_messages(sender_id, receiver_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_social_messages_receiver ON social_messages(receiver_id, read_at, created_at DESC);
