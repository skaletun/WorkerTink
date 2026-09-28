-- Keep the fixed development account authoritative even if an older database
-- was migrated before the role backfill was applied.
UPDATE profiles
SET is_dev = 1,
    is_admin = 1,
    updated_at = MAX(updated_at, strftime('%s','now') * 1000)
WHERE UPPER(wtink_id) = 'WTINKID-214994';
