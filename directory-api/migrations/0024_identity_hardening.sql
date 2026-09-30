-- 7.2.0: canonical username storage and case-insensitive uniqueness.
-- Drop the legacy case-sensitive index before normalizing existing values.
DROP INDEX IF EXISTS idx_profiles_username_unique;

-- Canonicalize existing usernames so every future comparison has one representation.
UPDATE profiles
SET username = LOWER(username)
WHERE username IS NOT NULL;

-- Preserve colliding historical usernames deterministically using the immutable WTinkID.
WITH ranked AS (
  SELECT
    wtink_id,
    username,
    ROW_NUMBER() OVER (PARTITION BY username ORDER BY created_at ASC, wtink_id ASC) AS rn
  FROM profiles
  WHERE username IS NOT NULL
)
UPDATE profiles
SET username = 'wtink_' || SUBSTR(REPLACE(profiles.wtink_id, 'WTinkID-', ''), 1, 6) || '_' || ranked.rn
FROM ranked
WHERE profiles.wtink_id = ranked.wtink_id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique
  ON profiles(username COLLATE NOCASE)
  WHERE username IS NOT NULL;
