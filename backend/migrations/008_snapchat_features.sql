-- Add saved messages table for messages users want to keep
CREATE TABLE IF NOT EXISTS saved_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    saved_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Add index for quick lookups
CREATE INDEX idx_saved_messages_user ON saved_messages(user_id);
CREATE INDEX idx_saved_messages_message ON saved_messages(message_id);

-- Function to find existing 1:1 chat between two users
CREATE OR REPLACE FUNCTION find_direct_chat(user1_id UUID, user2_id UUID)
RETURNS UUID AS $$
DECLARE
    chat_id UUID;
BEGIN
    SELECT cr.id INTO chat_id
    FROM chat_rooms cr
    WHERE cr.is_group = FALSE
    AND EXISTS (
        SELECT 1 FROM chat_members cm1
        WHERE cm1.chat_room_id = cr.id AND cm1.user_id = user1_id
    )
    AND EXISTS (
        SELECT 1 FROM chat_members cm2
        WHERE cm2.chat_room_id = cr.id AND cm2.user_id = user2_id
    )
    AND (
        SELECT COUNT(*) FROM chat_members cm3
        WHERE cm3.chat_room_id = cr.id
    ) = 2
    LIMIT 1;
    
    RETURN chat_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-delete view-once messages after being viewed
CREATE OR REPLACE FUNCTION auto_delete_viewed_message()
RETURNS TRIGGER AS $$
BEGIN
    -- If message is view_once, mark it as deleted after first view
    UPDATE messages
    SET deleted_at = NOW()
    WHERE id = NEW.message_id
    AND view_once = TRUE
    AND deleted_at IS NULL
    AND sender_id != NEW.user_id  -- Don't delete when sender views their own message
    AND NOT EXISTS (
        SELECT 1 FROM saved_messages
        WHERE message_id = NEW.message_id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on message_views
DROP TRIGGER IF EXISTS trigger_auto_delete_viewed_message ON message_views;
CREATE TRIGGER trigger_auto_delete_viewed_message
    AFTER INSERT ON message_views
    FOR EACH ROW
    EXECUTE FUNCTION auto_delete_viewed_message();

-- Function to clean up expired messages
CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS void AS $$
BEGIN
    -- Soft delete expired messages that aren't saved
    UPDATE messages
    SET deleted_at = NOW()
    WHERE expires_at IS NOT NULL
    AND expires_at < NOW()
    AND deleted_at IS NULL
    AND NOT EXISTS (
        SELECT 1 FROM saved_messages
        WHERE message_id = messages.id
    );
END;
$$ LANGUAGE plpgsql;
