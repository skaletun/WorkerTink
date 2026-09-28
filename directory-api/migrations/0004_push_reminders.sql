CREATE TABLE IF NOT EXISTS push_reminders (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('shift','absence','payroll')),
  due_at INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tag TEXT NOT NULL,
  sent_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(profile_id) REFERENCES profiles(wtink_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_reminders_due
ON push_reminders(due_at, sent_at);
CREATE INDEX IF NOT EXISTS idx_push_reminders_profile
ON push_reminders(profile_id, due_at);
