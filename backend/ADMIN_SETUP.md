# Admin Setup Guide

## Creating Admin Accounts on Production

There are multiple ways to promote a user to admin role:

### Method 1: Direct SQL (Recommended)

Connect to your production database and run:

```sql
-- Make a user admin by username
UPDATE users SET role = 'admin' WHERE username = 'your_username';

-- Or by email
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';

-- Verify
SELECT username, email, role FROM users WHERE role = 'admin';
```

### Method 2: Using the Script

```bash
# Set your production database URL
export DATABASE_URL="your_production_database_url"

# Run the script
./scripts/make_admin.sh your_username
# or
./scripts/make_admin.sh your@email.com
```

### Method 3: Railway CLI (if using Railway)

```bash
# Connect to production database
railway run psql $DATABASE_URL

# Then run the SQL commands from Method 1
```

### Method 4: Run Migration

The migration file `migrations/010_create_initial_admin.sql` will:
- Promote the first registered user to admin automatically
- Create a helper function `promote_to_admin(username_or_email)`

To use the helper function after migration:
```sql
SELECT promote_to_admin('your_username');
```

## Available Roles

- `user` - Default role, regular user
- `admin` - Full admin access (user management, ads, analytics)
- `moderator` - Admin access (can manage users and content)

## Admin Panel Access

Once promoted to admin, access the admin panel at:
```
https://your-domain.com/admin-panel
```

Features:
- User management (ban/unban users)
- Advertisement campaign management
- Analytics dashboard
- Audit logs

## Security Notes

- Only promote trusted users to admin
- Admin actions are logged in the `admin_logs` table
- Admins can manage other users but should use permissions responsibly
