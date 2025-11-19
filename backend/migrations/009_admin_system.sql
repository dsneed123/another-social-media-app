-- Admin System Migration
-- Adds role-based access control, user banning, advertisements, and analytics

-- Add role column to users table
ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user' NOT NULL;
ALTER TABLE users ADD CONSTRAINT check_user_role CHECK (role IN ('user', 'admin', 'moderator'));
CREATE INDEX idx_users_role ON users(role);

-- User bans table
CREATE TABLE user_bans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    banned_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    banned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    unbanned_at TIMESTAMP,
    unbanned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(user_id, is_active)
);
CREATE INDEX idx_user_bans_user_id ON user_bans(user_id);
CREATE INDEX idx_user_bans_active ON user_bans(user_id, is_active);

-- Advertisements table
CREATE TABLE advertisements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    link_url TEXT,
    target_impressions INTEGER NOT NULL CHECK (target_impressions > 0),
    current_impressions INTEGER NOT NULL DEFAULT 0,
    click_count INTEGER NOT NULL DEFAULT 0,
    budget DECIMAL(10, 2),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP,
    CONSTRAINT check_impressions CHECK (current_impressions <= target_impressions)
);
CREATE INDEX idx_ads_status ON advertisements(status);
CREATE INDEX idx_ads_created_by ON advertisements(created_by);

-- Ad impressions tracking (who saw which ads)
CREATE TABLE ad_impressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id UUID NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shown_at TIMESTAMP NOT NULL DEFAULT NOW(),
    clicked BOOLEAN NOT NULL DEFAULT false,
    clicked_at TIMESTAMP,
    UNIQUE(ad_id, user_id)
);
CREATE INDEX idx_ad_impressions_ad ON ad_impressions(ad_id);
CREATE INDEX idx_ad_impressions_user ON ad_impressions(user_id);
CREATE INDEX idx_ad_impressions_shown_at ON ad_impressions(shown_at);

-- Admin audit logs
CREATE TABLE admin_logs (
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
CREATE INDEX idx_admin_logs_admin ON admin_logs(admin_id);
CREATE INDEX idx_admin_logs_action ON admin_logs(action);
CREATE INDEX idx_admin_logs_created_at ON admin_logs(created_at DESC);
CREATE INDEX idx_admin_logs_target_user ON admin_logs(target_user_id);

-- Analytics snapshots (daily aggregated metrics)
CREATE TABLE analytics_snapshots (
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
CREATE INDEX idx_analytics_date ON analytics_snapshots(snapshot_date DESC);

-- Function to automatically update ad status when target reached
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

CREATE TRIGGER trigger_update_ad_status
    BEFORE UPDATE ON advertisements
    FOR EACH ROW
    EXECUTE FUNCTION update_ad_status();

-- Function to increment ad impressions when impression is recorded
CREATE OR REPLACE FUNCTION increment_ad_impressions()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE advertisements
    SET current_impressions = current_impressions + 1
    WHERE id = NEW.ad_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_ad_impressions
    AFTER INSERT ON ad_impressions
    FOR EACH ROW
    EXECUTE FUNCTION increment_ad_impressions();

-- Function to increment ad clicks when clicked
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

CREATE TRIGGER trigger_increment_ad_clicks
    AFTER UPDATE ON ad_impressions
    FOR EACH ROW
    EXECUTE FUNCTION increment_ad_clicks();

-- Helper view for active bans
CREATE VIEW active_bans AS
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

-- Helper view for ad campaign overview
CREATE VIEW ad_campaign_overview AS
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
