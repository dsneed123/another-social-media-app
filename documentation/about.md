RelayHub – MVP Product & System Design Document
Version: 1.0
Author: Davis Sneed
Date: November 2025
Platform: Mobile + Desktop
Backend: Rust + PostgreSQL + Redis + S3
Purpose: Define the first functional version of RelayHub suitable for closed beta and initial public testing.
1. Overview
RelayHub is a cross-platform social communication app centered on real-time messaging and story-driven content. The MVP focuses on reliability, speed, and usability, enabling users to:
- Chat in 1:1 or small group conversations
- Share short-form stories (photo or video)
- Manage simple profiles
- Adjust privacy and notification settings

The MVP omits algorithmic feeds, discovery systems, large-scale content recommendations, and advanced moderation — these will follow in later phases.
2. MVP Objectives
Chat – Deliver low-latency, reliable text/media messaging for individuals and small groups (up to 20 members).
Stories – Allow users to post ephemeral photo/video stories visible to friends for 24 hours.
Profiles – Provide a minimal public identity layer showing name, handle, profile photo, and story highlights.
Settings – Enable users to control privacy, notifications, and account security.
Performance – Maintain <150 ms message latency and stable media delivery.
3. Core Product Features
3.1 Chat System
Purpose: Enable fast, secure, and intuitive communication.

MVP Capabilities:
- Direct Chats (1:1): Persistent message history, image/video attachments, message read receipts.
- Group Chats: Small-scale (≤20 members), owner-created, persistent rooms.
- Media Messaging: Inline image/video previews (uploaded via S3).
- Realtime Sync: WebSocket connection maintains live message updates.
- Typing Indicators & Presence: Typing notifications and last active timestamps.

Out of Scope: Threaded replies, reactions, polls, or voice calls.
3.2 Stories
Purpose: Lightweight, ephemeral content for social sharing.

MVP Capabilities:
- Create Story: Upload image or video, add caption (text overlay optional).
- View Stories: Carousel format displaying stories from friends.
- Expiration: Auto-delete after 24 hours.
- Engagement: View count and viewer list visible to creator.
- Privacy: Visible only to friends (default).
3.3 Profiles
Purpose: Provide identity, context, and access to personal stories.

MVP Capabilities:
- Display username, profile picture, bio, and friend count.
- Tap to view current stories.
- Public/Private toggle (private = only friends can see profile).
3.4 Settings
Purpose: Basic control of account and user experience.

MVP Capabilities:
- Account: Edit username, display name, password, and profile image.
- Privacy: Toggle private profile, manage blocked users.
- Notifications: Enable/disable chat and story notifications.
- Session Management: Logout, clear device sessions.
4. System Architecture
RelayHub MVP will use a modular monolith architecture with distinct service layers but shared deployment and database.

Primary Components:
- Gateway/API Layer: REST + WebSocket entry point.
- Auth & User Service: Authentication, profiles, blocking.
- Chat Service: Manages rooms, messages, and real-time delivery.
- Stories Service: Handles uploads, expiration logic, and analytics.
- Media Service: Uploads, thumbnails, and S3 integration.
- Notification Service: Push notifications.
- Cache/Presence Layer: Redis for session and typing state.
- Database Layer: PostgreSQL for relational data, S3 for file storage.
5. Data Flow
Messaging Flow:
1. Client sends message → API validates → Chat Service stores.
2. Broadcast via WebSocket → recipients update chat view.
3. Redis maintains presence and read receipts.
4. Offline users get push notifications.

Story Flow:
1. Client uploads to S3 → submits metadata.
2. Story stored with expiration timestamp.
3. Friends fetch active stories.
4. Expired stories deleted periodically.
6. Technical Priorities
- Backend: Rust (Axum + Tokio)
- Database: PostgreSQL
- Cache: Redis
- Storage: S3-compatible (AWS S3 or MinIO)
- Auth: JWT-based
- Transport: REST + WebSocket
7. Scalability and Reliability
- Group chat limited to 20 members.
- WebSocket node capacity: ~50K concurrent sockets.
- Redis caches presence and receipts.
- S3 lifecycle rules handle media expiration.
- Prometheus metrics for latency and uptime.
8. Security & Privacy
- TLS 1.3 encryption.
- JWT-based authentication.
- User blocking and private profiles.
- Rate limiting to prevent spam.
- Controlled visibility for stories and chats.
9. Analytics and Observability
Operational Metrics: latency, connection counts, error rates.
Engagement Metrics: messages/day, stories/day, DAU, retention.
10. Future Roadmap
Phase 2: Reactions, pinned messages, search, recommendations.
Phase 3: Public discovery, large group chats, AI tagging.
Phase 4: Voice/video calls, moderation systems.
11. Summary
The RelayHub MVP delivers a secure, performant communication core with chat, stories, and profiles. It establishes a scalable foundation for future social and media-driven features while remaining lightweight and production-ready.

