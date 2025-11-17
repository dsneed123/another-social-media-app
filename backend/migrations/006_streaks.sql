-- Migration: User Streaks System
-- Track messaging streaks between users

CREATE TABLE IF NOT EXISTS user_streaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_interaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure user1_id < user2_id to avoid duplicates
    CONSTRAINT ordered_users CHECK (user1_id < user2_id),
    CONSTRAINT unique_streak_pair UNIQUE (user1_id, user2_id)
);

-- Index for fast lookups
CREATE INDEX idx_streaks_user1 ON user_streaks(user1_id);
CREATE INDEX idx_streaks_user2 ON user_streaks(user2_id);
CREATE INDEX idx_streaks_last_interaction ON user_streaks(last_interaction_date);

-- Function to update streak when message is sent
CREATE OR REPLACE FUNCTION update_streak(p_user1_id UUID, p_user2_id UUID)
RETURNS TABLE(current_streak INTEGER, longest_streak INTEGER) AS $$
DECLARE
    v_user1_id UUID;
    v_user2_id UUID;
    v_last_date DATE;
    v_current_streak INTEGER;
    v_longest_streak INTEGER;
    v_today DATE := CURRENT_DATE;
    v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
BEGIN
    -- Ensure user1_id < user2_id
    IF p_user1_id < p_user2_id THEN
        v_user1_id := p_user1_id;
        v_user2_id := p_user2_id;
    ELSE
        v_user1_id := p_user2_id;
        v_user2_id := p_user1_id;
    END IF;

    -- Check if streak exists
    SELECT last_interaction_date, user_streaks.current_streak, user_streaks.longest_streak
    INTO v_last_date, v_current_streak, v_longest_streak
    FROM user_streaks
    WHERE user1_id = v_user1_id AND user2_id = v_user2_id;

    IF NOT FOUND THEN
        -- Create new streak
        INSERT INTO user_streaks (user1_id, user2_id, current_streak, longest_streak, last_interaction_date)
        VALUES (v_user1_id, v_user2_id, 1, 1, v_today)
        RETURNING user_streaks.current_streak, user_streaks.longest_streak
        INTO current_streak, longest_streak;
    ELSIF v_last_date = v_today THEN
        -- Already interacted today, return current values
        current_streak := v_current_streak;
        longest_streak := v_longest_streak;
    ELSIF v_last_date = v_yesterday THEN
        -- Consecutive day, increment streak
        v_current_streak := v_current_streak + 1;
        v_longest_streak := GREATEST(v_longest_streak, v_current_streak);
        
        UPDATE user_streaks
        SET current_streak = v_current_streak,
            longest_streak = v_longest_streak,
            last_interaction_date = v_today,
            updated_at = NOW()
        WHERE user1_id = v_user1_id AND user2_id = v_user2_id;
        
        current_streak := v_current_streak;
        longest_streak := v_longest_streak;
    ELSE
        -- Streak broken, reset to 1
        UPDATE user_streaks
        SET current_streak = 1,
            longest_streak = v_longest_streak,
            last_interaction_date = v_today,
            updated_at = NOW()
        WHERE user1_id = v_user1_id AND user2_id = v_user2_id;
        
        current_streak := 1;
        longest_streak := v_longest_streak;
    END IF;

    RETURN QUERY SELECT current_streak, longest_streak;
END;
$$ LANGUAGE plpgsql;

-- Function to get streak between two users
CREATE OR REPLACE FUNCTION get_streak(p_user1_id UUID, p_user2_id UUID)
RETURNS TABLE(current_streak INTEGER, longest_streak INTEGER, last_interaction_date DATE) AS $$
DECLARE
    v_user1_id UUID;
    v_user2_id UUID;
BEGIN
    -- Ensure user1_id < user2_id
    IF p_user1_id < p_user2_id THEN
        v_user1_id := p_user1_id;
        v_user2_id := p_user2_id;
    ELSE
        v_user1_id := p_user2_id;
        v_user2_id := p_user1_id;
    END IF;

    RETURN QUERY
    SELECT us.current_streak, us.longest_streak, us.last_interaction_date
    FROM user_streaks us
    WHERE us.user1_id = v_user1_id AND us.user2_id = v_user2_id;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old broken streaks (optional maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_streaks()
RETURNS void AS $$
BEGIN
    DELETE FROM user_streaks
    WHERE last_interaction_date < CURRENT_DATE - INTERVAL '90 days'
    AND current_streak = 0;
END;
$$ LANGUAGE plpgsql;
