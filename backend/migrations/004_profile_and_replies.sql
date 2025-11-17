-- Add profile fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS about TEXT,
ADD COLUMN IF NOT EXISTS profile_link TEXT;

-- Add parent_comment_id for comment replies
ALTER TABLE story_comments
ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES story_comments(id) ON DELETE CASCADE;

-- Create index for faster parent comment lookups
CREATE INDEX IF NOT EXISTS idx_story_comments_parent ON story_comments(parent_comment_id);

-- Add reply_count to story_comments
ALTER TABLE story_comments
ADD COLUMN IF NOT EXISTS reply_count INTEGER DEFAULT 0;

-- Trigger to update reply counts
CREATE OR REPLACE FUNCTION update_comment_reply_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.parent_comment_id IS NOT NULL THEN
        UPDATE story_comments
        SET reply_count = reply_count + 1
        WHERE id = NEW.parent_comment_id;
    ELSIF TG_OP = 'DELETE' AND OLD.parent_comment_id IS NOT NULL THEN
        UPDATE story_comments
        SET reply_count = GREATEST(0, reply_count - 1)
        WHERE id = OLD.parent_comment_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_comment_reply_counts ON story_comments;
CREATE TRIGGER trigger_update_comment_reply_counts
    AFTER INSERT OR DELETE ON story_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_comment_reply_counts();
