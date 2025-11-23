# RelayHub System Architecture Diagram

## Full System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
        WebSocket[WebSocket Client]
        Camera[Webcam/Camera]
    end

    subgraph "Gateway Layer"
        API[API Gateway<br/>Rust/Axum]
        WS[WebSocket Server<br/>Real-time Connection]
    end

    subgraph "Service Layer"
        Auth[Auth & User Service<br/>Login/Signup/Profiles]
        Chat[Chat Service<br/>Messages & Rooms]
        Story[Stories Service<br/>24hr Content]
        Media[Media Service<br/>Upload/Processing]
        Notif[Notification Service<br/>Push Alerts]
    end

    subgraph "Data Layer"
        Redis[(Redis Cache<br/>Presence/Typing)]
        Postgres[(PostgreSQL<br/>Messages/Users)]
        S3[(AWS S3<br/>Photos/Videos)]
    end

    Browser -->|HTTP/REST| API
    WebSocket -->|WebSocket| WS
    Camera -->|Media Capture| Browser

    API --> Auth
    API --> Chat
    API --> Story
    API --> Media
    WS --> Chat

    Chat --> Notif
    Story --> Notif

    Auth --> Postgres
    Auth --> Redis
    Chat --> Postgres
    Chat --> Redis
    Story --> Postgres
    Story --> S3
    Media --> S3

    style Browser fill:#e1f5ff
    style API fill:#fff4e1
    style WS fill:#fff4e1
    style Auth fill:#ffe1e1
    style Chat fill:#ffe1e1
    style Story fill:#ffe1e1
    style Media fill:#ffe1e1
    style Notif fill:#ffe1e1
    style Redis fill:#e1ffe1
    style Postgres fill:#e1ffe1
    style S3 fill:#e1ffe1
```

## Message Flow Diagram

```mermaid
sequenceDiagram
    participant User as User Browser
    participant WS as WebSocket Server
    participant Chat as Chat Service
    participant DB as PostgreSQL
    participant Redis as Redis Cache
    participant Recipient as Other User

    User->>WS: Send Message
    WS->>Chat: Process Message
    Chat->>DB: Store Message
    Chat->>Redis: Update Read Status
    Chat->>WS: Broadcast to Recipients
    WS->>Recipient: Deliver Message (real-time)
    Recipient->>WS: Mark as Read
    WS->>Redis: Update Read Receipt
    WS->>User: Show Read Receipt
```

## Story Flow Diagram

```mermaid
sequenceDiagram
    participant User as User Browser
    participant API as API Gateway
    participant Media as Media Service
    participant S3 as AWS S3
    participant Story as Stories Service
    participant DB as PostgreSQL
    participant Friends as Friends' Browsers

    User->>API: Upload Photo/Video
    API->>Media: Process Upload
    Media->>S3: Store Media File
    S3-->>Media: Return URL
    Media->>Story: Create Story Entry
    Story->>DB: Save Story (24hr expiration)
    Story->>Friends: Notify New Story

    Note over DB,Story: Background Job runs every hour
    Story->>DB: Delete Expired Stories (>24hrs)
    Story->>S3: Delete Associated Media
```

## Technology Stack

```mermaid
graph LR
    subgraph "Frontend"
        HTML[HTML/CSS/JS]
        Canvas[Canvas API]
        WS_API[WebSocket API]
    end

    subgraph "Backend"
        Rust[Rust Language]
        Axum[Axum Framework]
        Tokio[Tokio Async Runtime]
        SQLx[SQLx - Type-safe SQL]
    end

    subgraph "Storage"
        PG[PostgreSQL]
        RD[Redis]
        S3_Store[AWS S3]
    end

    HTML --> Axum
    Canvas --> Axum
    WS_API --> Axum

    Axum --> Tokio
    Axum --> SQLx
    SQLx --> PG
    Axum --> RD
    Axum --> S3_Store
```

## Feature Components

```mermaid
mindmap
  root((RelayHub))
    Messaging
      Direct Chat
      Group Chat
      Read Receipts
      Typing Indicators
      View Once
    Stories
      24hr Expiration
      Photo/Video
      View Count
      Comments
      Likes
    Social
      Friends
      Streaks
      Presence Online
      Notifications
    Media
      Webcam Capture
      Photo Upload
      Video Upload
      S3 Storage
    Security
      JWT Auth
      Password Hashing
      Message Encryption
      Privacy Settings
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "GitHub"
        Code[Source Code]
        Actions[GitHub Actions CI/CD]
    end

    subgraph "DigitalOcean"
        Registry[Container Registry]
        AppPlatform[App Platform]
        DB_DO[Managed PostgreSQL]
        Redis_DO[Managed Redis]
    end

    subgraph "AWS"
        S3_AWS[S3 Bucket<br/>Media Storage]
    end

    Code -->|Push to main| Actions
    Actions -->|Build Docker Image| Registry
    Registry -->|Deploy| AppPlatform
    AppPlatform -->|Connect| DB_DO
    AppPlatform -->|Connect| Redis_DO
    AppPlatform -->|Upload Media| S3_AWS

    style Code fill:#e1f5ff
    style Actions fill:#fff4e1
    style AppPlatform fill:#ffe1e1
    style DB_DO fill:#e1ffe1
    style Redis_DO fill:#e1ffe1
    style S3_AWS fill:#ffe8e1
```

## How to View These Diagrams

1. **GitHub**: Push this file to GitHub - diagrams render automatically
2. **VS Code**: Install "Markdown Preview Mermaid Support" extension
3. **Online**: Copy the mermaid code to https://mermaid.live
4. **Export**: Use mermaid CLI to export as PNG/SVG

```bash
# Install mermaid CLI
npm install -g @mermaid-js/mermaid-cli

# Convert to PNG
mmdc -i ARCHITECTURE_DIAGRAM.md -o architecture.png
```
