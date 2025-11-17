-- Chat rooms (1:1 or group chats)
CREATE TABLE IF NOT EXISTS chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255), -- NULL for 1:1 chats, name for group chats
    is_group BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Chat room members
CREATE TABLE IF NOT EXISTS chat_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_read_at TIMESTAMP,
    UNIQUE(chat_room_id, user_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id),
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('text', 'image', 'video')),
    content TEXT, -- Text content or NULL for media
    media_url TEXT, -- S3 URL for images/videos
    media_thumbnail_url TEXT, -- Thumbnail for videos

    -- Snapchat-style features
    is_ephemeral BOOLEAN NOT NULL DEFAULT TRUE, -- View once like Snapchat
    expires_at TIMESTAMP, -- Auto-delete timestamp
    view_once BOOLEAN NOT NULL DEFAULT FALSE, -- Disappears after first view

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP, -- Soft delete for expired messages

    CONSTRAINT valid_content CHECK (
        (message_type = 'text' AND content IS NOT NULL) OR
        (message_type IN ('image', 'video') AND media_url IS NOT NULL)
    )
);

-- Message read receipts
CREATE TABLE IF NOT EXISTS message_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Message views (for ephemeral/view-once messages)
CREATE TABLE IF NOT EXISTS message_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Media metadata
CREATE TABLE IF NOT EXISTS media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    file_type VARCHAR(50) NOT NULL, -- image/jpeg, video/mp4, etc.
    file_size BIGINT NOT NULL,
    s3_key TEXT NOT NULL,
    s3_bucket TEXT NOT NULL,
    thumbnail_s3_key TEXT, -- For video thumbnails
    width INTEGER,
    height INTEGER,
    duration_seconds INTEGER, -- For videos
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP -- For ephemeral media
);

-- Indexes for performance
CREATE INDEX idx_messages_chat_room ON messages(chat_room_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_expires ON messages(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_chat_members_user ON chat_members(user_id);
CREATE INDEX idx_chat_members_room ON chat_members(chat_room_id);
CREATE INDEX idx_message_reads_message ON message_reads(message_id);
CREATE INDEX idx_message_views_message ON message_views(message_id);
CREATE INDEX idx_media_expires ON media(expires_at) WHERE expires_at IS NOT NULL;
