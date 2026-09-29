CREATE TABLE IF NOT EXISTS work_teams (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(owner_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS work_team_members (
  team_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at INTEGER NOT NULL,
  PRIMARY KEY(team_id, profile_id),
  FOREIGN KEY(team_id) REFERENCES work_teams(id) ON DELETE CASCADE,
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS work_documents (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(team_id) REFERENCES work_teams(id) ON DELETE CASCADE,
  FOREIGN KEY(owner_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_work_team_members_profile ON work_team_members(profile_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_documents_team ON work_documents(team_id, updated_at DESC);
