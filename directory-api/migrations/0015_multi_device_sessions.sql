-- 2.18.0: independent login sessions per device.
-- Legacy profiles.token_hash remains for backward compatibility, but new logins
-- are also persisted in auth_sessions so one device cannot invalidate another.
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_expiry
ON auth_sessions(token_hash, expires_at);
