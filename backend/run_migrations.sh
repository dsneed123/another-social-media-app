#!/bin/bash

# Database migration script for relays.social
# Runs all SQL migrations in order

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🗄️  Running database migrations...${NC}\n"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}❌ Error: .env file not found${NC}"
    exit 1
fi

# Extract database connection details from DATABASE_URL
# Format: postgres://user:password@host:port/database
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

# If port is not in URL, default to 5432
if [ -z "$DB_PORT" ]; then
    DB_PORT=5432
fi

echo -e "Database: ${GREEN}$DB_NAME${NC}"
echo -e "Host: ${GREEN}$DB_HOST:$DB_PORT${NC}"
echo -e "User: ${GREEN}$DB_USER${NC}\n"

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ Error: psql not found. Please install PostgreSQL client${NC}"
    exit 1
fi

# Test database connection
export PGPASSWORD=$DB_PASS
if ! psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c '\q' 2>/dev/null; then
    echo -e "${RED}❌ Error: Cannot connect to database${NC}"
    echo "Please check your DATABASE_URL in .env file"
    exit 1
fi

echo -e "${GREEN}✓ Database connection successful${NC}\n"

# Run migrations in order
MIGRATIONS_DIR="migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo -e "${RED}❌ Error: migrations directory not found${NC}"
    exit 1
fi

# Get all migration files sorted by number
MIGRATION_FILES=$(ls $MIGRATIONS_DIR/*.sql 2>/dev/null | sort -V)

if [ -z "$MIGRATION_FILES" ]; then
    echo -e "${YELLOW}⚠️  No migration files found${NC}"
    exit 0
fi

MIGRATION_COUNT=0
for migration in $MIGRATION_FILES; do
    MIGRATION_NAME=$(basename $migration)
    echo -e "${YELLOW}Running: $MIGRATION_NAME${NC}"

    if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $MIGRATION_NAME applied successfully${NC}\n"
        ((MIGRATION_COUNT++))
    else
        echo -e "${RED}❌ Failed to apply $MIGRATION_NAME${NC}"
        echo "Check the migration file for errors"
        exit 1
    fi
done

echo -e "${GREEN}✅ All migrations completed successfully!${NC}"
echo -e "${GREEN}Total migrations applied: $MIGRATION_COUNT${NC}"

unset PGPASSWORD
