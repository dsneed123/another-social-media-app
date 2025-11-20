# Production Database Schema Update

## Issue
The production database is missing several schema elements from migrations 009, 011, 012, and 013, causing errors like:
```
column u.role does not exist
```

## Solution
Run the `production_schema_update.sql` script to bring your production database up to date.

## What Gets Updated

### Users Table
- ✅ `role` column (VARCHAR, admin system support)
- ✅ `birthdate` column (DATE, for demographics)
- ✅ `gender` column (VARCHAR, for ad targeting)

### Advertisements Table
- ✅ `package_type` column (pricing tiers)
- ✅ `price` column (DOUBLE PRECISION)
- ✅ `contact_email` column
- ✅ `paid_at` column (payment timestamp)
- ✅ `start_date` column (when ad goes live)
- ✅ Updated status constraint (pending_payment, pending_approval, etc.)

### Ad Impressions Table
- ✅ Location tracking (country, city)
- ✅ Device tracking (device_type)
- ✅ Demographics (user_age_range, user_gender)

### New Tables
- ✅ `user_bans` - Track banned users
- ✅ `admin_logs` - Audit log for admin actions
- ✅ `analytics_snapshots` - Daily metrics
- ✅ `user_interests` - User interest tracking
- ✅ `ad_targeting` - Ad interest targeting
- ✅ `ad_performance_by_interest` - Analytics by interest
- ✅ `ad_performance_by_location` - Analytics by location

### Functions & Triggers
- ✅ `get_age_range()` - Calculate age range from birthdate
- ✅ Auto-update ad status when impressions reach target
- ✅ Auto-increment impression and click counters
- ✅ Auto-detect user interests from story interactions

### Views
- ✅ `active_bans` - Currently banned users
- ✅ `ad_campaign_overview` - Ad campaign summary with CTR

## How to Apply

### Option 1: Using psql (Recommended)
```bash
# Connect to your production database and run the script
psql $DATABASE_URL -f production_schema_update.sql
```

### Option 2: Using your database GUI
1. Copy the contents of `production_schema_update.sql`
2. Paste into your database GUI query editor
3. Execute the script

### Option 3: Using Render/Railway/etc Dashboard
1. Open your database dashboard
2. Navigate to the Query/SQL console
3. Copy and paste the entire `production_schema_update.sql` file
4. Execute

## Verification

After running the script, verify it worked:

```sql
-- Check users table columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('role', 'birthdate', 'gender');

-- Check advertisements table columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'advertisements'
  AND column_name IN ('package_type', 'price', 'start_date', 'paid_at');

-- Check new tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('user_bans', 'admin_logs', 'user_interests', 'ad_performance_by_location')
ORDER BY table_name;
```

Expected output should show all columns and tables exist.

## Safety Features

The script is safe to run multiple times because:
- Uses `IF NOT EXISTS` for tables and indexes
- Uses `ADD COLUMN IF NOT EXISTS` for columns
- Uses `CREATE OR REPLACE` for functions and views
- Wrapped in a transaction (BEGIN/COMMIT)
- Will rollback automatically if any error occurs

## After Update

Once the schema is updated, your backend should work without errors. You may want to:

1. **Restart your backend service** to clear any cached errors
2. **Create an admin user** (if you don't have one):
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
   ```
3. **Monitor logs** to ensure no more schema errors

## Troubleshooting

### If the script fails
1. Check the error message
2. The transaction will rollback automatically
3. Fix the specific issue and re-run

### If you still see "column does not exist" errors
1. Verify the script ran successfully
2. Check your DATABASE_URL points to the correct database
3. Restart your backend application
4. Check if there are connection pooling issues

### Common issues
- **Permission denied**: Ensure your database user has ALTER TABLE privileges
- **Relation already exists**: This is fine, the script will skip it
- **Transaction rollback**: Check the error message for details

## Need Help?

If you encounter issues:
1. Check the backend logs for the specific error
2. Verify your DATABASE_URL environment variable
3. Ensure you have proper database permissions
4. Try running the verification queries above
