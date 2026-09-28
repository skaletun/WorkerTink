ALTER TABLE profiles ADD COLUMN is_dev INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;

UPDATE profiles
SET is_dev = 1,
    is_admin = 1
WHERE UPPER(wtink_id) = 'WTINKID-214994';

CREATE INDEX IF NOT EXISTS idx_profiles_roles ON profiles(is_dev, is_admin);
