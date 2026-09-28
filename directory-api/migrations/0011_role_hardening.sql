-- Harden role storage after earlier releases could leave stale role flags.
-- The fixed development account is the sole dev/admin account.
UPDATE profiles
SET is_dev = CASE WHEN UPPER(wtink_id) = 'WTINKID-214994' THEN 1 ELSE 0 END,
    is_admin = CASE WHEN UPPER(wtink_id) = 'WTINKID-214994' THEN 1 ELSE 0 END,
    updated_at = MAX(updated_at, strftime('%s','now') * 1000);
