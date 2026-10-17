CREATE TABLE IF NOT EXISTS sound_tracks (
 id TEXT NOT NULL,
 owner_id TEXT NOT NULL REFERENCES profiles(wtink_id) ON DELETE CASCADE,
 metadata TEXT NOT NULL,
 object_key TEXT NOT NULL,
 size INTEGER NOT NULL,
 mime TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(owner_id,id)
);
CREATE INDEX IF NOT EXISTS sound_tracks_owner_created ON sound_tracks(owner_id,created_at DESC);
CREATE TABLE IF NOT EXISTS sound_import_limits (
 owner_id TEXT PRIMARY KEY REFERENCES profiles(wtink_id) ON DELETE CASCADE,
 window INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 1
);
