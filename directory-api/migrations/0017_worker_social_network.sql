-- 2.21.0: real WorkerTink social/work network layer.
ALTER TABLE social_posts ADD COLUMN kind TEXT NOT NULL DEFAULT 'post';
ALTER TABLE social_posts ADD COLUMN group_id TEXT;
ALTER TABLE social_posts ADD COLUMN visibility TEXT NOT NULL DEFAULT 'network';

CREATE TABLE IF NOT EXISTS social_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  owner_id TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(owner_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_social_groups_owner ON social_groups(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS social_group_members (
  group_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at INTEGER NOT NULL,
  PRIMARY KEY(group_id, profile_id),
  FOREIGN KEY(group_id) REFERENCES social_groups(id) ON DELETE CASCADE,
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_social_group_members_profile ON social_group_members(profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS social_events (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  group_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'work',
  starts_at INTEGER NOT NULL,
  ends_at INTEGER,
  location TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(owner_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE,
  FOREIGN KEY(group_id) REFERENCES social_groups(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_social_events_start ON social_events(starts_at ASC);
CREATE INDEX IF NOT EXISTS idx_social_events_group ON social_events(group_id, starts_at ASC);

CREATE TABLE IF NOT EXISTS social_event_members (
  event_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'going',
  created_at INTEGER NOT NULL,
  PRIMARY KEY(event_id, profile_id),
  FOREIGN KEY(event_id) REFERENCES social_events(id) ON DELETE CASCADE,
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_social_event_members_profile ON social_event_members(profile_id, status);

CREATE TABLE IF NOT EXISTS social_saved_posts (
  post_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(post_id, profile_id),
  FOREIGN KEY(post_id) REFERENCES social_posts(id) ON DELETE CASCADE,
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS work_shift_swaps (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  date TEXT NOT NULL,
  shift TEXT NOT NULL,
  requested_shift TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  claimed_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(owner_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE,
  FOREIGN KEY(claimed_by) REFERENCES profiles(wtink_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_work_swaps_open ON work_shift_swaps(status, date ASC);
CREATE INDEX IF NOT EXISTS idx_work_swaps_owner ON work_shift_swaps(owner_id, created_at DESC);
