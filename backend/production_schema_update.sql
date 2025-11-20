-- ============================================================================
-- PRODUCTION DATABASE SCHEMA UPDATE
-- ============================================================================
-- This script brings the production database up to date with all migrations
-- Run this on your production database to fix the missing schema elements
-- ============================================================================

BEGIN;

-- ============================================================================
-- USERS TABLE UPDATES
-- ============================================================================

-- Add role column for admin system (migration 009)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' NOT NULL;

-- Add constraint for role values
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_user_role') THEN
        ALTER TABLE users ADD CONSTRAINT check_user_role CHECK (role IN ('user', 'admin', 'moderator'));
    END IF;
END $$;

-- Add index for role lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Add demographic columns for ad targeting
ALTER TABLE users ADD COLUMN IF NOT EXISTS birthdate DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20);

-- ============================================================================
-- ADVERTISEMENTS TABLE UPDATES
-- ============================================================================

-- Add payment and tracking columns (migration 011 & 013)
ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS package_type VARCHAR(50);
ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS price DOUBLE PRECISION;
ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITHOUT TIME ZONE;

-- Update status constraint to include new statuses
ALTER TABLE advertisements DROP CONSTRAINT IF EXISTS check_ad_status;
ALTER TABLE advertisements DROP CONSTRAINT IF EXISTS advertisements_status_check;
ALTER TABLE advertisements ADD CONSTRAINT check_ad_status CHECK (
    status IN ('pending_payment', 'pending_approval', 'active', 'paused', 'completed', 'rejected', 'cancelled')
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_advertisements_status_created ON advertisements(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_advertisements_start_date ON advertisements(start_date DESC) WHERE start_date IS NOT NULL;

-- ============================================================================
-- AD IMPRESSIONS TABLE UPDATES
-- ============================================================================

-- Add demographic and location tracking (migration 012)
ALTER TABLE ad_impressions ADD COLUMN IF NOT EXISTS country VARCHAR(2);
ALTER TABLE ad_impressions ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE ad_impressions ADD COLUMN IF NOT EXISTS device_type VARCHAR(50);
ALTER TABLE ad_impressions ADD COLUMN IF NOT EXISTS user_age_range VARCHAR(20);
ALTER TABLE ad_impressions ADD COLUMN IF NOT EXISTS user_gender VARCHAR(20);

-- Add indexes for analytics
CREATE INDEX IF NOT EXISTS idx_ad_impressions_country ON ad_impressions(ad_id, country);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_city ON ad_impressions(ad_id, city);

-- ============================================================================
-- NEW TABLES FOR ADMIN & AD SYSTEM
-- ============================================================================

-- User bans table (migration 009)
CREATE TABLE IF NOT EXISTS user_bans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    banned_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    banned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    unbanned_at TIMESTAMP,
    unbanned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Add unique constraint for active bans
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_bans_user_id_is_active_key') THEN
        ALTER TABLE user_bans ADD CONSTRAINT user_bans_user_id_is_active_key UNIQUE(user_id, is_active);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_bans_user_id ON user_bans(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bans_active ON user_bans(user_id, is_active);

-- Admin logs table (migration 009)
CREATE TABLE IF NOT EXISTS admin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_resource_type VARCHAR(50),
    target_resource_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target_user ON admin_logs(target_user_id);

-- Analytics snapshots table (migration 009)
CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date DATE NOT NULL UNIQUE,
    total_users INTEGER NOT NULL DEFAULT 0,
    new_users INTEGER NOT NULL DEFAULT 0,
    active_users INTEGER NOT NULL DEFAULT 0,
    total_stories INTEGER NOT NULL DEFAULT 0,
    new_stories INTEGER NOT NULL DEFAULT 0,
    total_messages INTEGER NOT NULL DEFAULT 0,
    new_messages INTEGER NOT NULL DEFAULT 0,
    total_follows INTEGER NOT NULL DEFAULT 0,
    new_follows INTEGER NOT NULL DEFAULT 0,
    total_ad_impressions INTEGER NOT NULL DEFAULT 0,
    total_ad_clicks INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_snapshots(snapshot_date DESC);

-- User interests table (migration 012)
CREATE TABLE IF NOT EXISTS user_interests (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    interest VARCHAR(50) NOT NULL,
    score DECIMAL(3, 2) DEFAULT 0.5,
    last_updated TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, interest)
);

CREATE INDEX IF NOT EXISTS idx_user_interests_score ON user_interests(user_id, score DESC);

-- Ad targeting table (migration 012)
CREATE TABLE IF NOT EXISTS ad_targeting (
    ad_id UUID REFERENCES advertisements(id) ON DELETE CASCADE,
    interest VARCHAR(50) NOT NULL,
    PRIMARY KEY (ad_id, interest)
);

-- Ad performance by interest table (migration 012)
CREATE TABLE IF NOT EXISTS ad_performance_by_interest (
    ad_id UUID REFERENCES advertisements(id) ON DELETE CASCADE,
    interest VARCHAR(50) NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    ctr DECIMAL(5, 2) DEFAULT 0.0,
    last_updated TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (ad_id, interest)
);

-- Ad performance by location table (migration 012)
CREATE TABLE IF NOT EXISTS ad_performance_by_location (
    ad_id UUID REFERENCES advertisements(id) ON DELETE CASCADE,
    country VARCHAR(2) NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT '',
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    ctr DECIMAL(5, 2) DEFAULT 0.0,
    last_updated TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (ad_id, country, city)
);

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- Active bans view
CREATE OR REPLACE VIEW active_bans AS
SELECT
    ub.id,
    ub.user_id,
    u.username,
    u.email,
    ub.banned_by,
    admin.username as banned_by_username,
    ub.reason,
    ub.banned_at
FROM user_bans ub
JOIN users u ON ub.user_id = u.id
LEFT JOIN users admin ON ub.banned_by = admin.id
WHERE ub.is_active = true AND ub.unbanned_at IS NULL;

-- Ad campaign overview
CREATE OR REPLACE VIEW ad_campaign_overview AS
SELECT
    a.id,
    a.title,
    a.description,
    a.target_impressions,
    a.current_impressions,
    a.click_count,
    CASE
        WHEN a.current_impressions > 0 THEN ROUND((a.click_count::DECIMAL / a.current_impressions) * 100, 2)
        ELSE 0
    END as ctr_percentage,
    a.status,
    a.created_at,
    a.expires_at,
    u.username as created_by_username
FROM advertisements a
LEFT JOIN users u ON a.created_by = u.id;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate user age range from birthdate
CREATE OR REPLACE FUNCTION get_age_range(birthdate DATE) RETURNS VARCHAR(20) AS $$
BEGIN
    IF birthdate IS NULL THEN
        RETURN 'unknown';
    END IF;

    CASE
        WHEN DATE_PART('year', AGE(birthdate)) < 18 THEN RETURN 'under_18';
        WHEN DATE_PART('year', AGE(birthdate)) BETWEEN 18 AND 24 THEN RETURN '18-24';
        WHEN DATE_PART('year', AGE(birthdate)) BETWEEN 25 AND 34 THEN RETURN '25-34';
        WHEN DATE_PART('year', AGE(birthdate)) BETWEEN 35 AND 44 THEN RETURN '35-44';
        WHEN DATE_PART('year', AGE(birthdate)) BETWEEN 45 AND 54 THEN RETURN '45-54';
        WHEN DATE_PART('year', AGE(birthdate)) >= 55 THEN RETURN '55+';
        ELSE RETURN 'unknown';
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to update ad status when target reached (migration 009)
CREATE OR REPLACE FUNCTION update_ad_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_impressions >= NEW.target_impressions AND NEW.status = 'active' THEN
        NEW.status := 'completed';
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger to ensure it exists
DROP TRIGGER IF EXISTS trigger_update_ad_status ON advertisements;
CREATE TRIGGER trigger_update_ad_status
    BEFORE UPDATE ON advertisements
    FOR EACH ROW
    EXECUTE FUNCTION update_ad_status();

-- Function to increment ad impressions (migration 009)
CREATE OR REPLACE FUNCTION increment_ad_impressions()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE advertisements
    SET current_impressions = current_impressions + 1
    WHERE id = NEW.ad_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_ad_impressions ON ad_impressions;
CREATE TRIGGER trigger_increment_ad_impressions
    AFTER INSERT ON ad_impressions
    FOR EACH ROW
    EXECUTE FUNCTION increment_ad_impressions();

-- Function to increment ad clicks (migration 009)
CREATE OR REPLACE FUNCTION increment_ad_clicks()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.clicked = true AND OLD.clicked = false THEN
        UPDATE advertisements
        SET click_count = click_count + 1
        WHERE id = NEW.ad_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_ad_clicks ON ad_impressions;
CREATE TRIGGER trigger_increment_ad_clicks
    AFTER UPDATE ON ad_impressions
    FOR EACH ROW
    EXECUTE FUNCTION increment_ad_clicks();

-- Function to update user interests from story likes (migration 012)
CREATE OR REPLACE FUNCTION update_user_interests() RETURNS TRIGGER AS $$
DECLARE
    story_content TEXT;
    interests TEXT[];
    interest TEXT;
BEGIN
    -- Get the story content
    SELECT caption INTO story_content FROM stories WHERE id = NEW.story_id;

    -- Simple keyword-based interest detection
    interests := ARRAY[]::TEXT[];

    IF story_content ~* 'fashion|style|outfit|clothing|designer' THEN
        interests := array_append(interests, 'fashion');
    END IF;
    IF story_content ~* 'tech|technology|coding|software|gadget|ai|computer' THEN
        interests := array_append(interests, 'tech');
    END IF;
    IF story_content ~* 'sport|game|fitness|workout|gym|athlete' THEN
        interests := array_append(interests, 'sports');
    END IF;
    IF story_content ~* 'gaming|gamer|xbox|playstation|nintendo|esports' THEN
        interests := array_append(interests, 'gaming');
    END IF;
    IF story_content ~* 'travel|vacation|trip|adventure|explore' THEN
        interests := array_append(interests, 'travel');
    END IF;
    IF story_content ~* 'food|recipe|cooking|restaurant|chef' THEN
        interests := array_append(interests, 'food');
    END IF;
    IF story_content ~* 'music|concert|artist|song|album' THEN
        interests := array_append(interests, 'music');
    END IF;
    IF story_content ~* 'art|painting|drawing|creative|artist' THEN
        interests := array_append(interests, 'art');
    END IF;

    -- Insert or update interests
    FOREACH interest IN ARRAY interests
    LOOP
        INSERT INTO user_interests (user_id, interest, score, last_updated)
        VALUES (NEW.user_id, interest, 0.6, NOW())
        ON CONFLICT (user_id, interest) DO UPDATE
        SET score = LEAST(1.0, user_interests.score + 0.1),
            last_updated = NOW();
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if story_likes table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'story_likes') THEN
        DROP TRIGGER IF EXISTS trigger_update_interests_on_like ON story_likes;
        CREATE TRIGGER trigger_update_interests_on_like
        AFTER INSERT ON story_likes
        FOR EACH ROW
        EXECUTE FUNCTION update_user_interests();
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify the schema was updated correctly:
--
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'users' AND column_name IN ('role', 'birthdate', 'gender');
--
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'advertisements' AND column_name IN ('package_type', 'price', 'start_date', 'paid_at');
--
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name IN ('user_bans', 'admin_logs', 'user_interests', 'ad_performance_by_location');
-- ============================================================================
