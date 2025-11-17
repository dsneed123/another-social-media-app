-- Production Ready Migration for relays.social
-- Adds: profile pictures, display names, indexes, and performance optimizations

-- Add display_name and avatar_url to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;

-- Update existing users to have display_name = username if not set
UPDATE users SET display_name = username WHERE display_name IS NULL;

-- Add user preferences table for algorithm personalization
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    content_types JSONB DEFAULT '[]'::jsonb,
    interaction_weights JSONB DEFAULT '{
        "like": 1.0,
        "comment": 2.0,
        "view": 0.5,
        "share": 3.0
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add user interactions table for feed algorithm
CREATE TABLE IF NOT EXISTS user_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    interaction_type VARCHAR(20) NOT NULL, -- 'view', 'like', 'comment', 'skip'
    duration_seconds INTEGER, -- How long they viewed
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, story_id, interaction_type, created_at)
);

-- Add feed score cache table
CREATE TABLE IF NOT EXISTS feed_scores (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    score DECIMAL(10, 4) NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, story_id)
);

-- Performance Indexes

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_display_name_lower ON users(LOWER(display_name));
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Story indexes for feed algorithm
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_user_created ON stories(user_id, created_at DESC);

-- Follow relationship indexes
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_created_at ON follows(created_at DESC);

-- Story interaction indexes
CREATE INDEX IF NOT EXISTS idx_story_views_story_id ON story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_story_views_viewer_id ON story_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_story_likes_story_id ON story_likes(story_id);
CREATE INDEX IF NOT EXISTS idx_story_likes_user_id ON story_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_story_comments_story_id ON story_comments(story_id);
CREATE INDEX IF NOT EXISTS idx_story_comments_user_id ON story_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_story_comments_created ON story_comments(created_at DESC);

-- User interactions indexes for algorithm
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id ON user_interactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_interactions_story_id ON user_interactions(story_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type ON user_interactions(interaction_type);

-- Feed scores indexes
CREATE INDEX IF NOT EXISTS idx_feed_scores_user_score ON feed_scores(user_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_feed_scores_calculated ON feed_scores(calculated_at);

-- Chat indexes
CREATE INDEX IF NOT EXISTS idx_messages_chat_room ON messages(chat_room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

-- Add function to update feed scores timestamp
CREATE OR REPLACE FUNCTION update_feed_scores_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.calculated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for feed scores updates
DROP TRIGGER IF EXISTS trigger_update_feed_scores_timestamp ON feed_scores;
CREATE TRIGGER trigger_update_feed_scores_timestamp
    BEFORE UPDATE ON feed_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_feed_scores_timestamp();

-- Add search function for users (full-text search)
CREATE INDEX IF NOT EXISTS idx_users_search ON users 
    USING gin(to_tsvector('english', COALESCE(username, '') || ' ' || COALESCE(display_name, '') || ' ' || COALESCE(bio, '')));

-- Add materialized view for popular users (for discovery)
CREATE MATERIALIZED VIEW IF NOT EXISTS popular_users AS
SELECT 
    u.id,
    u.username,
    u.display_name,
    u.avatar_url,
    u.bio,
    COUNT(DISTINCT f.follower_id) as follower_count,
    COUNT(DISTINCT s.id) as story_count,
    COUNT(DISTINCT sl.id) as total_likes
FROM users u
LEFT JOIN follows f ON u.id = f.following_id
LEFT JOIN stories s ON u.id = s.user_id
LEFT JOIN story_likes sl ON s.id = sl.story_id
GROUP BY u.id
ORDER BY follower_count DESC, total_likes DESC;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_popular_users_id ON popular_users(id);

-- Function to refresh popular users (call this periodically)
CREATE OR REPLACE FUNCTION refresh_popular_users()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY popular_users;
END;
$$ LANGUAGE plpgsql;

-- Add cleanup function for old feed scores (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_feed_scores()
RETURNS void AS $$
BEGIN
    DELETE FROM feed_scores WHERE calculated_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Add cleanup function for old interactions (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_interactions()
RETURNS void AS $$
BEGIN
    DELETE FROM user_interactions WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE user_preferences IS 'Stores user content preferences for personalized feed algorithm';
COMMENT ON TABLE user_interactions IS 'Tracks all user interactions with stories for algorithm learning';
COMMENT ON TABLE feed_scores IS 'Cached feed scores for each user-story pair to optimize feed generation';
COMMENT ON MATERIALIZED VIEW popular_users IS 'Materialized view of popular users for discovery feature, refresh periodically';
