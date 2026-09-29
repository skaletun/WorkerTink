-- 3.0.0: public/private links for work chats and corporate channels.
ALTER TABLE chat_groups ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
ALTER TABLE company_channels ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
CREATE INDEX IF NOT EXISTS idx_chat_groups_visibility ON chat_groups(visibility);
CREATE INDEX IF NOT EXISTS idx_company_channels_visibility ON company_channels(visibility);
