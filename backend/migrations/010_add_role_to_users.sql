-- Add 'role' column to 'users' table
ALTER TABLE users ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'user';
