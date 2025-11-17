#!/bin/bash

# Deployment script for relays.social on DigitalOcean
# This script builds and deploys the application

set -e  # Exit on error

echo "🚀 Starting deployment for relays.social..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.production exists
if [ ! -f "backend/.env.production" ]; then
    echo "❌ Error: backend/.env.production not found!"
    echo "Please create it from backend/.env.production template"
    exit 1
fi

# Build backend
echo "${YELLOW}📦 Building backend...${NC}"
cd backend
cargo build --release
echo "${GREEN}✓ Backend built successfully${NC}"

# Copy production environment file
echo "${YELLOW}🔧 Configuring production environment...${NC}"
cp .env.production .env
echo "${GREEN}✓ Environment configured${NC}"

# Return to root
cd ..

echo "${GREEN}✅ Deployment preparation complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Upload the project to your DigitalOcean droplet"
echo "2. Install PostgreSQL and Redis"
echo "3. Run database migrations: cd backend && sqlx migrate run"
echo "4. Start the server: cd backend && ./target/release/backend"
echo "5. Configure nginx as reverse proxy (see DEPLOYMENT.md)"
echo ""
echo "For detailed instructions, see DEPLOYMENT.md"
