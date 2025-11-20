-- Enhanced ad tracking with location, demographics, and interests

-- Add location and demographic tracking to impressions
ALTER TABLE ad_impressions
ADD COLUMN IF NOT EXISTS country VARCHAR(2),
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS device_type VARCHAR(50), -- mobile, desktop, tablet
ADD COLUMN IF NOT EXISTS user_age_range VARCHAR(20), -- calculated from user profile
ADD COLUMN IF NOT EXISTS user_gender VARCHAR(20);

-- Add location and demographic tracking to clicks
ALTER TABLE ad_clicks
ADD COLUMN IF NOT EXISTS country VARCHAR(2),
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS device_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS user_age_range VARCHAR(20),
ADD COLUMN IF NOT EXISTS user_gender VARCHAR(20);

-- Create user interests table (inferred from their activity)
CREATE TABLE IF NOT EXISTS user_interests (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    interest VARCHAR(50) NOT NULL, -- e.g., 'fashion', 'tech', 'sports', 'gaming'
    score DECIMAL(3, 2) DEFAULT 0.5, -- 0.0 to 1.0, confidence score
    last_updated TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, interest)
);

-- Create ad targeting table (what interests an ad targets)
CREATE TABLE IF NOT EXISTS ad_targeting (
    ad_id UUID REFERENCES advertisements(id) ON DELETE CASCADE,
    interest VARCHAR(50) NOT NULL,
    PRIMARY KEY (ad_id, interest)
);

-- Create ad performance by interest table (aggregated analytics)
CREATE TABLE IF NOT EXISTS ad_performance_by_interest (
    ad_id UUID REFERENCES advertisements(id) ON DELETE CASCADE,
    interest VARCHAR(50) NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    ctr DECIMAL(5, 2) DEFAULT 0.0,
    last_updated TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (ad_id, interest)
);

-- Create ad performance by location table
CREATE TABLE IF NOT EXISTS ad_performance_by_location (
    ad_id UUID REFERENCES advertisements(id) ON DELETE CASCADE,
    country VARCHAR(2) NOT NULL,
    city VARCHAR(100),
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    ctr DECIMAL(5, 2) DEFAULT 0.0,
    last_updated TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (ad_id, country, COALESCE(city, ''))
);

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_ad_impressions_country ON ad_impressions(ad_id, country);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_city ON ad_impressions(ad_id, city);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_country ON ad_clicks(ad_id, country);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_city ON ad_clicks(ad_id, city);
CREATE INDEX IF NOT EXISTS idx_user_interests_score ON user_interests(user_id, score DESC);

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

-- Function to infer user interests from their activity
-- This is a simple heuristic - can be made more sophisticated
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

-- Trigger to update user interests when they like a story
CREATE TRIGGER trigger_update_interests_on_like
AFTER INSERT ON story_likes
FOR EACH ROW
EXECUTE FUNCTION update_user_interests();

-- Comments
COMMENT ON TABLE user_interests IS 'Tracks user interests inferred from their activity';
COMMENT ON TABLE ad_targeting IS 'Defines which interests an ad campaign targets';
COMMENT ON TABLE ad_performance_by_interest IS 'Ad performance metrics grouped by user interest';
COMMENT ON TABLE ad_performance_by_location IS 'Ad performance metrics grouped by geographic location';
