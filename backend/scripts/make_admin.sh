#!/bin/bash
# Script to promote a user to admin role
# Usage: ./scripts/make_admin.sh <username_or_email>

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <username_or_email>"
    echo "Example: $0 myusername"
    echo "Example: $0 user@example.com"
    exit 1
fi

USER_IDENTIFIER="$1"

echo "Promoting user '$USER_IDENTIFIER' to admin..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable not set"
    echo "Please set it with: export DATABASE_URL='your_database_url'"
    exit 1
fi

# Execute SQL to promote user
psql "$DATABASE_URL" <<SQL
-- Promote user to admin
UPDATE users
SET role = 'admin'
WHERE username = '$USER_IDENTIFIER' OR email = '$USER_IDENTIFIER';

-- Verify it worked
SELECT
    username,
    email,
    role,
    created_at
FROM users
WHERE username = '$USER_IDENTIFIER' OR email = '$USER_IDENTIFIER';

-- Show all admins
SELECT
    username,
    email,
    role
FROM users
WHERE role = 'admin';
SQL

echo ""
echo "✅ Done! User '$USER_IDENTIFIER' should now be an admin."
echo "You can verify by logging in and accessing /admin-panel"
