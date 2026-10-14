CREATE TABLE IF NOT EXISTS admin_audit_events (
 id TEXT PRIMARY KEY,
 admin_id TEXT NOT NULL,
 action TEXT NOT NULL,
 target_kind TEXT NOT NULL,
 target_id TEXT NOT NULL,
 note TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL,
 FOREIGN KEY(admin_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_recent ON admin_audit_events(created_at DESC);
