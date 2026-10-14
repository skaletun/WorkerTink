-- Public QR appearance is account-owned, not device-owned.
CREATE TABLE IF NOT EXISTS profile_qr_styles (
  profile_id TEXT PRIMARY KEY REFERENCES profiles(wtink_id) ON DELETE CASCADE,
  shape TEXT NOT NULL DEFAULT 'Rounded',
  foreground TEXT NOT NULL DEFAULT '#142a23',
  background TEXT NOT NULL DEFAULT '#ffffff',
  card TEXT NOT NULL DEFAULT 'Soft',
  updated_at INTEGER NOT NULL
);
