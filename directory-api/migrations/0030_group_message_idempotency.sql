-- Group-chat equivalent of the personal-message idempotency key.
-- Earlier encrypted messages retain NULL identifiers unchanged.
ALTER TABLE chat_group_messages ADD COLUMN client_message_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_group_message_sender_client_id
 ON chat_group_messages(group_id,sender_id,client_message_id) WHERE client_message_id IS NOT NULL;
