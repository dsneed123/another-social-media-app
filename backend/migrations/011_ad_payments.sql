-- Add payment fields to advertisements table for self-service advertising

ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS package_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITHOUT TIME ZONE;

-- Update status check constraint to include pending_payment and pending_approval
ALTER TABLE advertisements DROP CONSTRAINT IF EXISTS check_ad_status;
ALTER TABLE advertisements
ADD CONSTRAINT check_ad_status CHECK (
    status IN ('pending_payment', 'pending_approval', 'active', 'paused', 'completed', 'rejected')
);

-- Create index for pending ads (for admin panel)
CREATE INDEX IF NOT EXISTS idx_advertisements_status_created
ON advertisements(status, created_at DESC);

-- Add comments
COMMENT ON COLUMN advertisements.package_type IS 'Package type: starter, growth, premium';
COMMENT ON COLUMN advertisements.price IS 'Price paid for the ad campaign in USD';
COMMENT ON COLUMN advertisements.contact_email IS 'Contact email for campaign updates';
COMMENT ON COLUMN advertisements.paid_at IS 'When payment was confirmed';
