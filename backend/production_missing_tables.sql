-- Create advertisements table
CREATE TABLE IF NOT EXISTS advertisements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    link_url TEXT,
    target_impressions INTEGER NOT NULL CHECK (target_impressions > 0),
    current_impressions INTEGER NOT NULL DEFAULT 0,
    click_count INTEGER NOT NULL DEFAULT 0,
    budget DOUBLE PRECISION,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITHOUT TIME ZONE,
    package_type VARCHAR(32),
    price DOUBLE PRECISION,
    contact_email VARCHAR(255),
    paid_at TIMESTAMP WITHOUT TIME ZONE,
    start_date TIMESTAMP WITHOUT TIME ZONE
);

-- Create ad_impressions table
CREATE TABLE IF NOT EXISTS ad_impressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id UUID NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    country VARCHAR(2),
    city VARCHAR(100),
    device_type VARCHAR(32),
    user_age_range VARCHAR(16),
    user_gender VARCHAR(16),
    clicked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create admin_logs table
CREATE TABLE IF NOT EXISTS admin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(64) NOT NULL,
    target_resource_type VARCHAR(32),
    target_resource_id UUID,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create ad_performance_by_location table
CREATE TABLE IF NOT EXISTS ad_performance_by_location (
    ad_id UUID REFERENCES advertisements(id) ON DELETE CASCADE,
    country VARCHAR(2) NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT '',
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    ctr DOUBLE PRECISION DEFAULT 0.0,
    last_updated TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (ad_id, country, city)
);

-- Create ad_performance_by_interest table
CREATE TABLE IF NOT EXISTS ad_performance_by_interest (
    ad_id UUID REFERENCES advertisements(id) ON DELETE CASCADE,
    interest VARCHAR(64) NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    ctr DOUBLE PRECISION DEFAULT 0.0,
    last_updated TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (ad_id, interest)
);

-- Create analytics_snapshots table
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
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create user_interests table
CREATE TABLE IF NOT EXISTS user_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interest VARCHAR(64) NOT NULL,
    score DOUBLE PRECISION DEFAULT 0.0,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create ad_targeting table
CREATE TABLE IF NOT EXISTS ad_targeting (
    ad_id UUID REFERENCES advertisements(id) ON DELETE CASCADE,
    interest VARCHAR(64),
    country VARCHAR(2),
    age_range VARCHAR(16),
    gender VARCHAR(16),
    PRIMARY KEY (ad_id, interest, country, age_range, gender)
);
