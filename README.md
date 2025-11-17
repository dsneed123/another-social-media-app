# relays.social - Snapchat-Style Social Media Platform

A modern, real-time social media platform with Snapchat-inspired features including disappearing messages, stories, view-once media, and friend streaks.

**🌐 Domain**: [relays.social](https://relays.social)
**📦 Status**: Production-ready ✅

## 🌟 Features

### Core Features
- **💬 Real-time Chat**: WebSocket-powered instant messaging
- **📸 Snaps**: Send disappearing photos and videos
- **👁️ View Once**: Messages and media that disappear after viewing
- **📖 Stories**: 24-hour stories with views, likes, and comments
- **🔥 Streaks**: Track consecutive days of messaging with friends
- **👥 Group Chats**: Create and manage group conversations
- **🔔 Real-time Notifications**: Instant notifications for messages and interactions
- **💾 Save Messages**: Save important messages from disappearing
- **🎨 Customization**: Avatar uploads and profile customization
- **🔐 Secure Authentication**: JWT-based authentication with bcrypt password hashing

## Technology Stack

### Backend
- **Rust** - High-performance backend
- **Axum** - Web framework with WebSocket support
- **Tokio** - Async runtime
- **PostgreSQL** - Relational database
- **Redis** - Caching and presence management
- **AWS S3** - Media file storage
- **SQLx** - Type-safe SQL queries
- **JWT** - Authentication

### Frontend
- **HTML/CSS/JavaScript** - Responsive UI
- **WebSocket API** - Real-time communication
- **MediaDevices API** - Webcam access
- **Canvas API** - Image processing

## 🚀 Quick Start

### Using Docker (Recommended for Development)

```bash
# Start all services
docker-compose up -d

# The app will be available at http://localhost:3000
```

### Manual Setup

#### 1. Prerequisites
```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install Redis
sudo apt install redis-server

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 2. Database Setup
```bash
# Create database
createdb relayhub

# Run migrations
cd backend
psql -d relayhub -f migrations/001_messaging_schema.sql
```

### 3. Configure Environment
```bash
cd backend
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### 4. Start Services
```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start backend
cd backend
cargo run
```

### 5. Access Application
- Open browser to http://127.0.0.1:3000
- Create an account
- Start chatting with webcam photos!

## 🔄 CI/CD Pipeline (No SSH Required!)

**Automated deployments are set up!** Every push to `main` automatically deploys to production.

### Quick Setup (5 minutes)

1. **Create DigitalOcean Account** and get your [API token](https://cloud.digitalocean.com/account/api/tokens)

2. **Add GitHub Secrets** (Settings > Secrets > Actions):
   ```
   DIGITALOCEAN_ACCESS_TOKEN = your_do_token
   DIGITALOCEAN_APP_ID = your_app_id
   ADMIN_TOKEN = random_secret_string
   ```

3. **Deploy App Platform**:
   ```bash
   doctl apps create --spec .do/app.yaml
   ```

4. **Push to main**:
   ```bash
   git push origin main
   ```

**That's it!** GitHub Actions will automatically build, test, and deploy. No SSH needed!

👉 **Complete Guide**: [CI_CD_SETUP.md](./CI_CD_SETUP.md) - Full setup with screenshots and troubleshooting

### What Happens on Every Push

- ✅ Builds Docker image
- ✅ Pushes to DigitalOcean Container Registry
- ✅ Deploys to App Platform
- ✅ Runs database migrations
- ✅ Health checks
- ✅ Live at https://relays.social

## 📦 Production Deployment

Ready to deploy to **relays.social** on DigitalOcean?

### Deployment Options

**Option 1: App Platform (Recommended - No SSH)**
- Fully managed, auto-scaling
- Built-in CI/CD with GitHub
- Zero DevOps work
- See [CI_CD_SETUP.md](./CI_CD_SETUP.md)

**Option 2: Traditional Droplet (Manual)**
- Full control over server
- Requires SSH and maintenance
- See [DEPLOYMENT.md](./DEPLOYMENT.md)

### Quick Deploy
```bash
# 1. Configure production environment
cd backend
cp .env.production .env
nano .env  # Update with your production credentials

# 2. Build for production
cd ..
./deploy.sh

# 3. See full deployment guide
```

### Complete Deployment Guide

👉 **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete DigitalOcean deployment guide including:
- Server setup and configuration
- Database and Redis installation
- Nginx reverse proxy configuration
- SSL certificate setup with Let's Encrypt
- Systemd service configuration
- Domain DNS configuration
- Monitoring and maintenance

### Deployment Files

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Full deployment guide
- **[QUICKSTART.md](./QUICKSTART.md)** - Quick start guide
- **[deploy.sh](./deploy.sh)** - Automated deployment script
- **[backend/run_migrations.sh](./backend/run_migrations.sh)** - Database migration script
- **[backend/.env.production](./backend/.env.production)** - Production environment template
- **[docker-compose.yml](./docker-compose.yml)** - Docker setup for development

## Documentation

- **Setup Guide**: [documentation/SETUP.md](documentation/SETUP.md)
- **Product Spec**: [documentation/about.md](documentation/about.md)

## Key Features Implemented

✅ **WebSocket real-time messaging**
✅ **Webcam photo capture and upload**
✅ **View-once Snapchat-style messages**
✅ **Message expiration with auto-deletion**
✅ **Typing indicators**
✅ **Read receipts**
✅ **Online presence tracking**
✅ **Redis caching layer**
✅ **S3 media storage**
✅ **Background expiration service**

## Architecture Highlights

- **WebSocket connections** managed with DashMap for thread-safe concurrent access
- **Redis** for presence, typing indicators, and unread counters
- **PostgreSQL** with proper indexes for message retrieval
- **S3** for media storage with automatic thumbnail generation
- **Background tasks** for automatic message cleanup
- **Broadcast channels** for efficient message distribution

## API Endpoints

```
POST   /api/signup                              # Create account
POST   /api/login                               # Login
POST   /api/chats                               # Create chat room
GET    /api/users/:user_id/chats                # List user's chats
GET    /api/users/:user_id/chats/:chat_id/messages  # Get messages
POST   /api/media/upload                        # Upload webcam image
WS     /ws/:user_id                             # WebSocket connection
```

See [documentation/SETUP.md](documentation/SETUP.md) for detailed API documentation.

## Made with ❤️ using Rust 🦀
