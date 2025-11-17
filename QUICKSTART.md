# Quick Start Guide - relays.social

## Local Development

### 1. Prerequisites
- Rust (latest stable)
- PostgreSQL
- Redis
- Node.js (optional, for frontend tools)

### 2. Setup Database
```bash
# Start PostgreSQL (if using Docker)
docker run -d --name postgres -p 5434:5432 \
  -e POSTGRES_USER=relayhub_user \
  -e POSTGRES_PASSWORD=supersecretpassword \
  -e POSTGRES_DB=relayhub \
  postgres:15

# Start Redis
docker run -d --name redis -p 6379:6379 redis:7
```

### 3. Configure Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
./run_migrations.sh
```

### 4. Run Backend
```bash
cd backend
cargo run --release
```

The server will start at `http://localhost:3000`

### 5. Access Application
Open your browser to:
- Login page: `http://localhost:3000/`
- Chat page: `http://localhost:3000/chat`
- Stories page: `http://localhost:3000/stories`

---

## Production Deployment (DigitalOcean)

### Quick Deploy
```bash
# 1. Build for production
./deploy.sh

# 2. Upload to server
scp -r . user@relays.social:/home/relay/app

# 3. SSH into server and setup
ssh user@relays.social
cd /home/relay/app/backend
./run_migrations.sh
cargo build --release

# 4. Start with systemd (see DEPLOYMENT.md)
sudo systemctl start relays
```

### Complete Instructions
See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deployment guide including:
- Server setup
- Nginx configuration
- SSL certificates
- Database backups
- Monitoring

---

## Environment Variables

### Backend (.env)
```bash
# Server
HOST=0.0.0.0
PORT=3000
CORS_ORIGIN=https://relays.social

# Database
DATABASE_URL=postgres://user:pass@host/db

# JWT Secret
JWT_SECRET=your-secret-key

# Redis
REDIS_URL=redis://127.0.0.1:6379

# Cloudflare R2
AWS_REGION=auto
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET_NAME=your-bucket
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

### Frontend (config.js)
The frontend automatically detects the environment:
- **Development**: Uses `http://localhost:3000` and `ws://localhost:3000`
- **Production**: Uses `https://relays.social` and `wss://relays.social`

---

## Key Features

- 💬 Real-time chat with WebSocket
- 📸 Snapchat-style disappearing messages
- 👁️ View-once images and texts
- 📖 Stories with 24-hour expiration
- 🔥 Friend streaks
- 🔔 Real-time notifications
- 👥 Group chats
- 💾 Message saving
- 🎨 Custom avatars
- 🔐 JWT authentication

---

## Testing

### Test WebSocket Connection
```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:3000/ws/1
```

### Test API Endpoints
```bash
# Health check
curl http://localhost:3000/health

# Login
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'
```

---

## Troubleshooting

### Backend won't start
```bash
# Check logs
cargo run

# Common issues:
# - Database not running
# - Redis not running
# - Wrong DATABASE_URL in .env
# - Missing JWT_SECRET in .env
```

### Frontend can't connect
```bash
# Check if backend is running
curl http://localhost:3000/health

# Check WebSocket
wscat -c ws://localhost:3000/ws/1

# Verify CORS settings in backend .env
```

### Database migrations fail
```bash
# Check database connection
psql $DATABASE_URL

# Run migrations manually
cd backend
for f in migrations/*.sql; do
    psql $DATABASE_URL -f "$f"
done
```

---

## Useful Commands

### Backend
```bash
# Run in development mode
cargo run

# Build for production
cargo build --release

# Run tests
cargo test

# Check code
cargo clippy
```

### Database
```bash
# Connect to database
psql $DATABASE_URL

# Run migrations
./backend/run_migrations.sh

# Backup database
pg_dump $DATABASE_URL > backup.sql
```

### Server Management (Production)
```bash
# View logs
sudo journalctl -u relays -f

# Restart service
sudo systemctl restart relays

# Check status
sudo systemctl status relays
```

---

## Support & Resources

- Full deployment guide: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Backend API documentation: Coming soon
- Frontend documentation: Coming soon

---

## License

Private project - All rights reserved
