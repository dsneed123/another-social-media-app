use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State, Path,
    },
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use futures::{sink::SinkExt, stream::StreamExt};
use std::sync::Arc;
use dashmap::DashMap;
use tokio::sync::broadcast;

use crate::AppState;

// Global map to track active WebSocket connections
pub type Connections = Arc<DashMap<Uuid, broadcast::Sender<String>>>;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsMessage {
    // Client -> Server
    SendMessage {
        chat_room_id: Uuid,
        content: Option<String>,
        message_type: String,
        media_url: Option<String>,
        view_once: bool,
        expires_in_seconds: Option<i64>,
    },
    TypingStart {
        chat_room_id: Uuid,
    },
    TypingStop {
        chat_room_id: Uuid,
    },
    MarkRead {
        message_id: Uuid,
    },
    MarkViewed {
        message_id: Uuid,
    },

    // Server -> Client
    NewMessage {
        id: Uuid,
        chat_room_id: Uuid,
        sender_id: Uuid,
        sender_username: String,
        message_type: String,
        content: Option<String>,
        media_url: Option<String>,
        media_thumbnail_url: Option<String>,
        view_once: bool,
        created_at: String,
    },
    UserTyping {
        chat_room_id: Uuid,
        user_id: Uuid,
        username: String,
    },
    UserStoppedTyping {
        chat_room_id: Uuid,
        user_id: Uuid,
    },
    MessageRead {
        message_id: Uuid,
        user_id: Uuid,
        read_at: String,
    },
    MessageViewed {
        message_id: Uuid,
        user_id: Uuid,
        viewed_at: String,
    },
    MessageExpired {
        message_id: Uuid,
    },
    Error {
        message: String,
    },
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(user_id): Path<Uuid>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, user_id, state))
}

async fn handle_socket(socket: WebSocket, user_id: Uuid, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();

    // Only create a new broadcast channel if one does not exist
    // Always ensure a broadcast channel exists for the user
    let tx = state.connections.entry(user_id).or_insert_with(|| {
        let (tx, _) = broadcast::channel(100);
        tx
    }).clone();
    let mut rx = tx.subscribe();

    tracing::info!("WebSocket connected: {}", user_id);

    // Set user online in Redis
    {
        let mut redis = state.redis.lock().await;
        let _ = redis.set_user_online(user_id).await;
    }

    // Spawn a task to forward broadcast messages to WebSocket
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if let Err(e) = sender.send(Message::Text(msg)).await {
                tracing::warn!("WebSocket send error for user {}: {:?}", user_id, e);
                break;
            }
        }
    });

    // Handle incoming WebSocket messages
    let connections = state.connections.clone();
    let pool = state.pool.clone();
    let redis = state.redis.clone();

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(Message::Text(text))) = receiver.next().await {
            match serde_json::from_str::<WsMessage>(&text) {
                Ok(ws_msg) => {
                    handle_ws_message(ws_msg, user_id, &pool, &redis, &connections).await;
                }
                Err(e) => {
                    tracing::error!("Failed to parse WsMessage: {}", e);
                }
            }
        }
    });

    // Wait for either task to finish
    tokio::select! {
        _ = (&mut send_task) => {
            tracing::info!("Send task ended for user {}", user_id);
            recv_task.abort()
        },
        _ = (&mut recv_task) => {
            tracing::info!("Recv task ended for user {}", user_id);
            send_task.abort()
        },
    };

    // Clean up connection
    state.connections.remove(&user_id);
    tracing::info!("WebSocket disconnected: {}", user_id);
    {
        let mut redis = state.redis.lock().await;
        let _ = redis.set_user_offline(user_id).await;
    }
}

async fn handle_ws_message(
    msg: WsMessage,
    user_id: Uuid,
    pool: &Arc<sqlx::PgPool>,
    redis: &Arc<tokio::sync::Mutex<crate::redis_client::RedisClient>>,
    connections: &Connections,
) {
    match msg {
        WsMessage::SendMessage {
            chat_room_id,
            content,
            message_type,
            media_url,
            view_once,
            expires_in_seconds,
        } => {
            // Calculate expiration
            let expires_at = expires_in_seconds.map(|seconds| {
                (chrono::Utc::now() + chrono::Duration::seconds(seconds)).naive_utc()
            });

            // Insert message into database
            let result = sqlx::query!(
                r#"
                INSERT INTO messages
                (chat_room_id, sender_id, message_type, content, media_url, view_once, expires_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id, created_at
                "#,
                chat_room_id,
                user_id,
                message_type,
                content,
                media_url,
                view_once,
                expires_at
            )
            .fetch_one(pool.as_ref())
            .await;

            if let Ok(record) = result {
                // Get sender username
                let sender = sqlx::query!("SELECT username FROM users WHERE id = $1", user_id)
                    .fetch_one(pool.as_ref())
                    .await;
                if let Ok(sender) = sender {
                    // Get all members of the chat room
                    let members = sqlx::query!(
                        "SELECT user_id FROM chat_members WHERE chat_room_id = $1",
                        chat_room_id
                    )
                    .fetch_all(pool.as_ref())
                    .await;
                    if let Ok(members) = members {
                        // Broadcast to all chat members (including sender)
                        let broadcast_msg = WsMessage::NewMessage {
                            id: record.id,
                            chat_room_id,
                            sender_id: user_id,
                            sender_username: sender.username,
                            message_type: message_type.clone(),
                            content: content.clone(),
                            media_url: media_url.clone(),
                            media_thumbnail_url: None,
                            view_once,
                            created_at: record.created_at.format("%Y-%m-%dT%H:%M:%S%.fZ").to_string(),
                        };
                        let msg_json = serde_json::to_string(&broadcast_msg).unwrap();
                        for member in members {
                            if let Some(conn) = connections.get(&member.user_id) {
                                let _ = conn.send(msg_json.clone());
                            } else {
                                // User is offline, increment unread counter
                                let mut redis_guard = redis.lock().await;
                                let _ = redis_guard.increment_unread(member.user_id, chat_room_id).await;
                            }
                        }
                    } else {
                        tracing::error!("Failed to fetch chat members for room {}", chat_room_id);
                    }
                } else {
                    tracing::error!("Failed to fetch sender username for user {}", user_id);
                }
            } else if let Err(e) = result {
                tracing::error!("Failed to insert message: {}", e);
            }
        }

        WsMessage::TypingStart { chat_room_id } => {
            {
                let mut redis_guard = redis.lock().await;
                let _ = redis_guard.set_typing(user_id, chat_room_id).await;
            }

            // Get sender username
            if let Ok(sender) = sqlx::query!("SELECT username FROM users WHERE id = $1", user_id)
                .fetch_one(pool.as_ref())
                .await
            {
                // Broadcast typing indicator to chat members (including sender)
                let members = sqlx::query!(
                    "SELECT user_id FROM chat_members WHERE chat_room_id = $1",
                    chat_room_id
                )
                .fetch_all(pool.as_ref())
                .await
                .unwrap();

                let typing_msg = WsMessage::UserTyping {
                    chat_room_id,
                    user_id,
                    username: sender.username,
                };

                let msg_json = serde_json::to_string(&typing_msg).unwrap();

                for member in members {
                    if let Some(conn) = connections.get(&member.user_id) {
                        let _ = conn.send(msg_json.clone());
                    }
                }
            }
        }

        WsMessage::TypingStop { chat_room_id } => {
            {
                let mut redis_guard = redis.lock().await;
                let _ = redis_guard.clear_typing(user_id, chat_room_id).await;
            }

            // Broadcast stopped typing to chat members
            let members = sqlx::query!(
                "SELECT user_id FROM chat_members WHERE chat_room_id = $1",
                chat_room_id
            )
            .fetch_all(pool.as_ref())
            .await
            .unwrap();

            let stop_typing_msg = WsMessage::UserStoppedTyping {
                chat_room_id,
                user_id,
            };

            let msg_json = serde_json::to_string(&stop_typing_msg).unwrap();

            for member in members {
                if let Some(conn) = connections.get(&member.user_id) {
                    let _ = conn.send(msg_json.clone());
                }
            }
        }

        WsMessage::MarkRead { message_id } => {
            // Insert read receipt
            let result = sqlx::query!(
                "INSERT INTO message_reads (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING read_at",
                message_id,
                user_id
            )
            .fetch_optional(pool.as_ref())
            .await;

            if let Ok(Some(record)) = result {
                // Get message sender
                if let Ok(msg) = sqlx::query!(
                    "SELECT sender_id, chat_room_id FROM messages WHERE id = $1",
                    message_id
                )
                .fetch_one(pool.as_ref())
                .await
                {
                    // Clear unread counter
                    {
                        let mut redis_guard = redis.lock().await;
                        let _ = redis_guard.clear_unread(user_id, msg.chat_room_id).await;
                    }

                    // Notify sender
                    let read_msg = WsMessage::MessageRead {
                        message_id,
                        user_id,
                        read_at: record.read_at.format("%Y-%m-%dT%H:%M:%S%.fZ").to_string(),
                    };

                    let msg_json = serde_json::to_string(&read_msg).unwrap();

                    if let Some(conn) = connections.get(&msg.sender_id) {
                        let _ = conn.send(msg_json);
                    }
                }
            } else if let Err(e) = result {
                tracing::error!("Failed to insert read receipt: {}", e);
            }
        }

        WsMessage::MarkViewed { message_id } => {
            // Insert view record
            let result = sqlx::query!(
                "INSERT INTO message_views (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING viewed_at",
                message_id,
                user_id
            )
            .fetch_optional(pool.as_ref())
            .await;

            if let Ok(Some(record)) = result {
                // Check if message is view_once
                if let Ok(msg) = sqlx::query!(
                    "SELECT sender_id, view_once FROM messages WHERE id = $1",
                    message_id
                )
                .fetch_one(pool.as_ref())
                .await
                {
                    // Notify sender about view
                    let viewed_msg = WsMessage::MessageViewed {
                        message_id,
                        user_id,
                        viewed_at: record.viewed_at.format("%Y-%m-%dT%H:%M:%S%.fZ").to_string(),
                    };

                    let msg_json = serde_json::to_string(&viewed_msg).unwrap();

                    if let Some(conn) = connections.get(&msg.sender_id) {
                        let _ = conn.send(msg_json);
                    }

                    // If view_once, delete the message and notify all participants
                    if msg.view_once {
                        let _ = sqlx::query!(
                            "UPDATE messages SET deleted_at = NOW() WHERE id = $1",
                            message_id
                        )
                        .execute(pool.as_ref())
                        .await;

                        let expired_msg = WsMessage::MessageExpired { message_id };
                        let expired_json = serde_json::to_string(&expired_msg).unwrap();

                        // Get all members of the chat room
                        if let Ok(members) = sqlx::query!(
                            "SELECT user_id FROM chat_members WHERE chat_room_id = (SELECT chat_room_id FROM messages WHERE id = $1)",
                            message_id
                        )
                        .fetch_all(pool.as_ref())
                        .await
                        {
                            for member in members {
                                if let Some(conn) = connections.get(&member.user_id) {
                                    let _ = conn.send(expired_json.clone());
                                }
                            }
                        }
                    }
                }
            } else if let Err(e) = result {
                tracing::error!("Failed to insert view record: {}", e);
            }
        }

        _ => {}
    }
}
