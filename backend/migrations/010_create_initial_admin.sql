-- Create initial admin account
-- Run this migration on production after your first user signs up
-- Replace 'your_username' with your actual username

-- Promote first user to admin (uncomment and modify as needed)
-- UPDATE users SET role = 'admin' WHERE username = 'your_username';

-- Or use this to make the first registered user an admin automatically
UPDATE users
SET role = 'admin'
WHERE id = (
    SELECT id FROM users
    ORDER BY created_at ASC
    LIMIT 1
);

-- Optional: Create a function to easily promote users
CREATE OR REPLACE FUNCTION promote_to_admin(user_identifier TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET role = 'admin'
    WHERE username = user_identifier OR email = user_identifier;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User % not found', user_identifier;
    END IF;

    RAISE NOTICE 'User % promoted to admin', user_identifier;
END;
$$ LANGUAGE plpgsql;

-- Usage example (uncomment to use):
-- SELECT promote_to_admin('your_username');
