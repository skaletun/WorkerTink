-- 2.18.0: explicit per-device authentication sessions.
ALTER TABLE auth_sessions ADD COLUMN session_id TEXT;
ALTER TABLE auth_sessions ADD COLUMN device_name TEXT NOT NULL DEFAULT 'Устройство';
ALTER TABLE auth_sessions ADD COLUMN last_seen INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_session_id ON auth_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_profile_active ON auth_sessions(profile_id,expires_at,last_seen);
