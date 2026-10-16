-- Ephemeral, auth-bound device-to-device E2E key transfer.
-- Private E2E keys and the shared secret never appear in this table.
CREATE TABLE IF NOT EXISTS e2e_transfer_sessions (
 id TEXT PRIMARY KEY,
 profile_id TEXT NOT NULL,
 target_session_hash TEXT NOT NULL,
 source_session_hash TEXT,
 target_public_key TEXT NOT NULL,
 source_public_key TEXT,
 source_confirmed_at INTEGER,
 target_confirmed_at INTEGER,
 encrypted_payload TEXT,
 payload_created_at INTEGER,
 consumed_at INTEGER,
 cancelled_at INTEGER,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_e2e_transfer_profile_expiry ON e2e_transfer_sessions(profile_id,expires_at);
CREATE TABLE IF NOT EXISTS e2e_transfer_audit (
 id TEXT PRIMARY KEY,
 transfer_id TEXT NOT NULL,
 profile_id TEXT NOT NULL,
 event TEXT NOT NULL CHECK (event IN ('created','joined','source_confirmed','target_confirmed','encrypted_payload_ready','consumed','cancelled')),
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_e2e_transfer_audit_expiry ON e2e_transfer_audit(created_at);
