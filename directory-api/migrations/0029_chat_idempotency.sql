-- Exactly-once logical message creation for persisted offline queues.
-- Existing messages retain NULL client_message_id and are not changed.
ALTER TABLE social_messages ADD COLUMN client_message_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_social_messages_sender_client_id
 ON social_messages(sender_id,client_message_id) WHERE client_message_id IS NOT NULL;
