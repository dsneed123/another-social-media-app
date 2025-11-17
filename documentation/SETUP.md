# RelayHub Setup Guide

## Snapchat-Style Messaging System

This guide will help you set up the RelayHub messaging system with WebSockets, Redis, and S3 integration.

## Features

### Core Messaging Features
- **Real-time messaging** via WebSockets
- **Text messages** with instant delivery
- **Image messages** captured from webcam
- **View-once messages** (Snapchat-style)
- **Message expiration** with automatic deletion
- **Typing indicators**
- **Read receipts**
- **Online presence** tracking
- **Unread message counters**

### Technical Stack
- **Backend**: Rust (Axum + Tokio)
- **Database**: PostgreSQL
- **Cache**: Redis
- **Storage**: AWS S3
- **Real-time**: WebSockets
- **Frontend**: HTML/CSS/JavaScript

## Prerequisites

1. **PostgreSQL** (version 14+)
2. **Redis** (version 6+)
3. **AWS Account** with S3 bucket (or MinIO for local development)
4. **Rust** (latest stable version)

## Installation Steps

### 1. Database Setup

```bash
# Create PostgreSQL database
createdb relayhub

# Or using psql
psql -U postgres
CREATE DATABASE relayhub;
```

### 2. Run Database Migrations

```bash
cd backend

# Run the migration SQL file
psql -U your_username -d relayhub -f migrations/001_messaging_schema.sql
```

### 3. Redis Setup

```bash
# Start Redis server (if not already running)
redis-server

# Or using Docker
docker run -d -p 6379:6379 redis:latest
```

### 4. AWS S3 Setup

#### Option A: AWS S3 (Production)
1. Create an S3 bucket in AWS Console
2. Create IAM user with S3 permissions
3. Get Access Key and Secret Key
4. Configure CORS for your bucket:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": []
    }
]
```

#### Option B: MinIO (Local Development)

```bash
# Using Docker
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  --name minio \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"

# Access MinIO Console at http://localhost:9001
# Create a bucket named "relayhub-media"
```

### 5. Environment Configuration

```bash
cd backend
cp .env.example .env

# Edit .env with your actual credentials
nano .env
```

Required environment variables:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/relayhub
REDIS_URL=redis://127.0.0.1:6379
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=relayhub-media
```

### 6. Build and Run

```bash
cd backend

# Build the project
cargo build

# Run the server
cargo run
```

The server will start on `http://127.0.0.1:3000`

### 7. Access the Application

1. **Login Page**: http://127.0.0.1:3000/
2. **Chat Interface**: http://127.0.0.1:3000/chat

## API Endpoints

### Authentication
- `POST /api/signup` - Create new account
- `POST /api/login` - Login and get JWT token

### Chat
- `POST /api/chats` - Create new chat room
- `GET /api/users/:user_id/chats` - Get user's chat rooms
- `GET /api/users/:user_id/chats/:chat_room_id/messages` - Get messages

### Media
- `POST /api/media/upload` - Upload image from webcam (base64)
- `POST /api/media/upload-multipart` - Upload media file

### WebSocket
- `WS /ws/:user_id` - WebSocket connection for real-time messaging

## WebSocket Message Types

### Client → Server

```javascript
// Send text message
{
  "type": "send_message",
  "chat_room_id": "uuid",
  "content": "Hello!",
  "message_type": "text",
  "view_once": false,
  "expires_in_seconds": null
}

// Send image message (Snapchat-style)
{
  "type": "send_message",
  "chat_room_id": "uuid",
  "message_type": "image",
  "media_url": "https://...",
  "view_once": true,
  "expires_in_seconds": 86400
}

// Typing indicator
{
  "type": "typing_start",
  "chat_room_id": "uuid"
}

// Mark message as read
{
  "type": "mark_read",
  "message_id": "uuid"
}

// Mark message as viewed (for view-once)
{
  "type": "mark_viewed",
  "message_id": "uuid"
}
```

### Server → Client

```javascript
// New message received
{
  "type": "new_message",
  "id": "uuid",
  "chat_room_id": "uuid",
  "sender_id": "uuid",
  "sender_username": "john",
  "message_type": "text",
  "content": "Hello!",
  "view_once": false,
  "created_at": "2025-11-16T..."
}

// User typing
{
  "type": "user_typing",
  "chat_room_id": "uuid",
  "user_id": "uuid",
  "username": "john"
}

// Message expired
{
  "type": "message_expired",
  "message_id": "uuid"
}
```

## Snapchat-Style Features

### View Once Messages
Images sent with `view_once: true` will be automatically deleted after being viewed once.

```javascript
// Send view-once image
sendMessage(null, 'image', imageUrl, true, null);
```

### Expiring Messages
Set `expires_in_seconds` to automatically delete messages after a time period.

```javascript
// Message expires in 24 hours
sendMessage("Hello!", 'text', null, false, 86400);
```

### Webcam Capture
Click the camera button to capture a photo directly from your webcam and send it as a message.

## Background Services

### Message Expiration Service
Runs every 60 seconds to:
- Delete expired messages
- Clean up expired media from S3
- Remove viewed view-once messages

## Development Tips

### Testing WebSockets
Use the browser console to test WebSocket messages:

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://127.0.0.1:3000/ws/your-user-id');

// Send message
ws.send(JSON.stringify({
  type: 'send_message',
  chat_room_id: 'chat-id',
  content: 'Test message',
  message_type: 'text'
}));
```

### Monitoring Redis
```bash
# Connect to Redis CLI
redis-cli

# Monitor all commands
MONITOR

# View all keys
KEYS *

# Get typing users
KEYS typing:*
```

### Database Queries
```sql
-- View all messages
SELECT * FROM messages ORDER BY created_at DESC LIMIT 10;

-- View expired messages
SELECT * FROM messages WHERE expires_at < NOW();

-- View view-once messages
SELECT * FROM messages WHERE view_once = true;
```

## Troubleshooting

### WebSocket won't connect
- Check that the server is running
- Verify the WebSocket URL is correct
- Check browser console for errors

### Images not uploading
- Verify S3 credentials in .env
- Check S3 bucket permissions
- Ensure CORS is configured on S3 bucket

### Messages not expiring
- Check that expiration service is running
- Verify database timestamps are correct
- Check server logs for errors

### Redis connection failed
- Ensure Redis is running: `redis-cli ping`
- Check REDIS_URL in .env
- Verify firewall settings

## Production Deployment

### Security Considerations
1. Change `JWT_SECRET` to a strong random value
2. Use HTTPS for WebSocket connections (wss://)
3. Enable S3 bucket encryption
4. Use environment-specific credentials
5. Enable rate limiting
6. Add input validation and sanitization

### Performance Optimization
1. Use Redis clustering for scalability
2. Enable S3 CloudFront CDN
3. Add database connection pooling
4. Implement message pagination
5. Add message caching in Redis

## Support

For issues and questions, check:
- Server logs: `cargo run` output
- Browser console: Developer Tools → Console
- Redis logs: `redis-cli MONITOR`
- Database logs: PostgreSQL logs

---

**Built with Rust, PostgreSQL, Redis, and S3 for blazing-fast Snapchat-style messaging!**
