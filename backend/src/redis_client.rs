use redis::{Client, AsyncCommands, RedisResult, aio::ConnectionManager};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Clone)]
pub struct RedisClient {
    manager: ConnectionManager,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UserPresence {
    pub user_id: Uuid,
    pub online: bool,
    pub last_seen: DateTime<Utc>,
    pub typing_in_chat: Option<Uuid>, // Chat room ID if typing
}

impl RedisClient {
    pub async fn new(redis_url: &str) -> RedisResult<Self> {
        let client = Client::open(redis_url)?;
        let manager = ConnectionManager::new(client).await?;
        Ok(Self { manager })
    }

    // Presence management
    pub async fn set_user_online(&mut self, user_id: Uuid) -> RedisResult<()> {
        let key = format!("presence:user:{}", user_id);
        let presence = UserPresence {
            user_id,
            online: true,
            last_seen: Utc::now(),
            typing_in_chat: None,
        };
        let value = serde_json::to_string(&presence).unwrap();
        self.manager.set_ex(&key, value, 300).await // 5 min TTL
    }

    pub async fn set_user_offline(&mut self, user_id: Uuid) -> RedisResult<()> {
        let key = format!("presence:user:{}", user_id);
        let presence = UserPresence {
            user_id,
            online: false,
            last_seen: Utc::now(),
            typing_in_chat: None,
        };
        let value = serde_json::to_string(&presence).unwrap();
        self.manager.set_ex(&key, value, 86400).await // 24 hours
    }

    pub async fn set_typing(&mut self, user_id: Uuid, chat_room_id: Uuid) -> RedisResult<()> {
        let key = format!("typing:{}:{}", chat_room_id, user_id);
        self.manager.set_ex(&key, "1", 5).await // 5 second TTL
    }

    pub async fn clear_typing(&mut self, user_id: Uuid, chat_room_id: Uuid) -> RedisResult<()> {
        let key = format!("typing:{}:{}", chat_room_id, user_id);
        self.manager.del(&key).await
    }

    pub async fn get_typing_users(&mut self, chat_room_id: Uuid) -> RedisResult<Vec<Uuid>> {
        let pattern = format!("typing:{}:*", chat_room_id);
        let keys: Vec<String> = self.manager.keys(&pattern).await?;

        let user_ids = keys.iter()
            .filter_map(|key| {
                key.split(':').nth(2).and_then(|id| Uuid::parse_str(id).ok())
            })
            .collect();

        Ok(user_ids)
    }

    // Cache message reads
    pub async fn cache_last_read(&mut self, user_id: Uuid, chat_room_id: Uuid) -> RedisResult<()> {
        let key = format!("last_read:{}:{}", user_id, chat_room_id);
        let timestamp = Utc::now().timestamp();
        self.manager.set_ex(&key, timestamp, 3600).await // 1 hour cache
    }

    // WebSocket connection tracking
    pub async fn add_ws_connection(&mut self, user_id: Uuid, connection_id: &str) -> RedisResult<()> {
        let key = format!("ws_connections:{}", user_id);
        self.manager.sadd(&key, connection_id).await
    }

    pub async fn remove_ws_connection(&mut self, user_id: Uuid, connection_id: &str) -> RedisResult<()> {
        let key = format!("ws_connections:{}", user_id);
        self.manager.srem(&key, connection_id).await
    }

    pub async fn get_user_connections(&mut self, user_id: Uuid) -> RedisResult<Vec<String>> {
        let key = format!("ws_connections:{}", user_id);
        self.manager.smembers(&key).await
    }

    // Message delivery tracking
    pub async fn mark_message_delivered(&mut self, message_id: Uuid, user_id: Uuid) -> RedisResult<()> {
        let key = format!("delivered:{}:{}", message_id, user_id);
        self.manager.set_ex(&key, "1", 86400).await // 24 hours
    }

    // Unread message counter
    pub async fn increment_unread(&mut self, user_id: Uuid, chat_room_id: Uuid) -> RedisResult<i32> {
        let key = format!("unread:{}:{}", user_id, chat_room_id);
        self.manager.incr(&key, 1).await
    }

    pub async fn clear_unread(&mut self, user_id: Uuid, chat_room_id: Uuid) -> RedisResult<()> {
        let key = format!("unread:{}:{}", user_id, chat_room_id);
        self.manager.del(&key).await
    }

    pub async fn get_unread_count(&mut self, user_id: Uuid, chat_room_id: Uuid) -> RedisResult<i32> {
        let key = format!("unread:{}:{}", user_id, chat_room_id);
        let count: Option<i32> = self.manager.get(&key).await?;
        Ok(count.unwrap_or(0))
    }
}
