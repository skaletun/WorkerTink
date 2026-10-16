-- Keep the ECDH sender identity with each wrapped group key, so recipients
-- can decrypt keys distributed by any group administrator.
ALTER TABLE chat_group_keys ADD COLUMN sender_public_key TEXT;
