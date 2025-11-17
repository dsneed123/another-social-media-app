-- Notifications system for follows, likes, comments, etc.

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'follow', 'like', 'comment', 'reply', 'mention'
    from_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES story_comments(id) ON DELETE CASCADE,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);

-- Function to create follow notification
CREATE OR REPLACE FUNCTION create_follow_notification()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notifications (user_id, type, from_user_id, message)
    VALUES (
        NEW.following_id,
        'follow',
        NEW.follower_id,
        (SELECT username FROM users WHERE id = NEW.follower_id) || ' started following you'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for follow notifications
DROP TRIGGER IF EXISTS follow_notification_trigger ON follows;
CREATE TRIGGER follow_notification_trigger
    AFTER INSERT ON follows
    FOR EACH ROW
    EXECUTE FUNCTION create_follow_notification();

-- Function to create like notification
CREATE OR REPLACE FUNCTION create_like_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify if it's not the user's own story
    IF (SELECT user_id FROM stories WHERE id = NEW.story_id) != NEW.user_id THEN
        INSERT INTO notifications (user_id, type, from_user_id, story_id, message)
        VALUES (
            (SELECT user_id FROM stories WHERE id = NEW.story_id),
            'like',
            NEW.user_id,
            NEW.story_id,
            (SELECT username FROM users WHERE id = NEW.user_id) || ' liked your story'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for like notifications
DROP TRIGGER IF EXISTS like_notification_trigger ON story_likes;
CREATE TRIGGER like_notification_trigger
    AFTER INSERT ON story_likes
    FOR EACH ROW
    EXECUTE FUNCTION create_like_notification();

-- Function to create comment notification
CREATE OR REPLACE FUNCTION create_comment_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify if it's not the user's own story
    IF (SELECT user_id FROM stories WHERE id = NEW.story_id) != NEW.user_id THEN
        INSERT INTO notifications (user_id, type, from_user_id, story_id, comment_id, message)
        VALUES (
            (SELECT user_id FROM stories WHERE id = NEW.story_id),
            'comment',
            NEW.user_id,
            NEW.story_id,
            NEW.id,
            (SELECT username FROM users WHERE id = NEW.user_id) || ' commented on your story'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for comment notifications
DROP TRIGGER IF EXISTS comment_notification_trigger ON story_comments;
CREATE TRIGGER comment_notification_trigger
    AFTER INSERT ON story_comments
    FOR EACH ROW
    EXECUTE FUNCTION create_comment_notification();

-- Function to clean up old read notifications (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM notifications
    WHERE is_read = TRUE
    AND created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
