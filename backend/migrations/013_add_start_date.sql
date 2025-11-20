-- Add start_date column to advertisements table

ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITHOUT TIME ZONE;

-- Add comment
COMMENT ON COLUMN advertisements.start_date IS 'When the ad campaign was approved and started';

-- Create index for filtering active campaigns by start date
CREATE INDEX IF NOT EXISTS idx_advertisements_start_date
ON advertisements(start_date DESC)
WHERE start_date IS NOT NULL;
