use axum::{
    extract::{Json, State, Path, Query},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;
use std::sync::Arc;
use chrono::{DateTime, Utc, NaiveDateTime};

#[derive(Serialize, Deserialize)]
pub struct CreateChatRequest {
    pub creator_id: Uuid, // User creating the chat
    pub is_group: bool,
    pub name: Option<String>,
    pub member_ids: Vec<Uuid>, // User IDs to add to chat
}

#[derive(Serialize, Deserialize)]
pub struct ChatRoomResponse {
    pub id: Uuid,
    pub name: Option<String>,
    pub is_group: bool,
    pub created_at: NaiveDateTime,
    pub members: Vec<ChatMemberResponse>,
    pub last_message: Option<MessageResponse>,
}

#[derive(Serialize, Deserialize)]
pub struct ChatMemberResponse {
    pub user_id: Uuid,
    pub username: String,
    pub joined_at: NaiveDateTime,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MessageResponse {
    pub id: Uuid,
    pub chat_room_id: Uuid,
    pub sender_id: Uuid,
    pub sender_username: String,
    pub message_type: String,
    pub content: Option<String>,
    pub media_url: Option<String>,
    pub media_thumbnail_url: Option<String>,
    pub view_once: bool,
    pub is_ephemeral: bool,
    pub expires_at: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub is_viewed: bool,
    pub is_read: bool,
    pub is_saved: bool,
}

#[derive(Deserialize)]
pub struct GetMessagesQuery {
    pub limit: Option<i64>,
    pub before: Option<Uuid>, // Message ID for pagination
}

// Create a new chat room
pub async fn create_chat(
    State(state): State<Arc<crate::AppState>>,
    Json(payload): Json<CreateChatRequest>,
) -> Result<Json<ChatRoomResponse>, StatusCode> {
    let pool = &state.pool;
    let creator_id = payload.creator_id;

    // For 1:1 chats, check if chat already exists
    if !payload.is_group && payload.member_ids.len() == 1 {
        let other_user_id = payload.member_ids[0];
        
        // Check for existing direct chat
        let existing_chat = sqlx::query!(
            "SELECT find_direct_chat($1, $2) as chat_id",
            creator_id,
            other_user_id
        )
        .fetch_one(pool.as_ref())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        if let Some(chat_id) = existing_chat.chat_id {
            // Return existing chat instead of creating new one
            let members = sqlx::query!(
                r#"
                SELECT cm.user_id, u.username, cm.joined_at
                FROM chat_members cm
                JOIN users u ON cm.user_id = u.id
                WHERE cm.chat_room_id = $1
                "#,
                chat_id
            )
            .fetch_all(pool.as_ref())
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .into_iter()
            .map(|r| ChatMemberResponse {
                user_id: r.user_id,
                username: r.username,
                joined_at: r.joined_at,
            })
            .collect();

            let existing_room = sqlx::query!(
                "SELECT id, name, is_group, created_at FROM chat_rooms WHERE id = $1",
                chat_id
            )
            .fetch_one(pool.as_ref())
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            return Ok(Json(ChatRoomResponse {
                id: existing_room.id,
                name: existing_room.name,
                is_group: existing_room.is_group,
                created_at: existing_room.created_at,
                members,
                last_message: None,
            }));
        }
    }

    // Create chat room (name is NULL for 1:1 chats)
    let chat_room = sqlx::query!(
        r#"
        INSERT INTO chat_rooms (is_group, name, created_by)
        VALUES ($1, $2, $3)
        RETURNING id, name, is_group, created_at, updated_at
        "#,
        payload.is_group,
        if payload.is_group { payload.name } else { None },
        creator_id
    )
    .fetch_one(pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Add creator as member
    let mut all_member_ids = payload.member_ids.clone();
    all_member_ids.push(creator_id);

    for member_id in all_member_ids {
        sqlx::query!(
            "INSERT INTO chat_members (chat_room_id, user_id) VALUES ($1, $2)",
            chat_room.id,
            member_id
        )
        .execute(pool.as_ref())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    // Fetch members
    let members = sqlx::query!(
        r#"
        SELECT cm.user_id, u.username, cm.joined_at
        FROM chat_members cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.chat_room_id = $1
        "#,
        chat_room.id
    )
    .fetch_all(pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .into_iter()
    .map(|r| ChatMemberResponse {
        user_id: r.user_id,
        username: r.username,
        joined_at: r.joined_at,
    })
    .collect();

    Ok(Json(ChatRoomResponse {
        id: chat_room.id,
        name: chat_room.name,
        is_group: chat_room.is_group,
        created_at: chat_room.created_at,
        members,
        last_message: None,
    }))
}

// Get user's chat rooms
pub async fn get_user_chats(
    State(state): State<Arc<crate::AppState>>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Vec<ChatRoomResponse>>, StatusCode> {
    let pool = &state.pool;
    let chat_rooms = sqlx::query!(
        r#"
        SELECT DISTINCT cr.id, cr.name, cr.is_group, cr.created_at, cr.updated_at
        FROM chat_rooms cr
        JOIN chat_members cm ON cr.id = cm.chat_room_id
        WHERE cm.user_id = $1
        ORDER BY cr.updated_at DESC
        "#,
        user_id
    )
    .fetch_all(pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut responses = Vec::new();

    for room in chat_rooms {
        // Get members
        let members: Vec<ChatMemberResponse> = sqlx::query!(
            r#"
            SELECT cm.user_id, u.username, cm.joined_at
            FROM chat_members cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.chat_room_id = $1
            "#,
            room.id
        )
        .fetch_all(pool.as_ref())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .into_iter()
        .map(|r| ChatMemberResponse {
            user_id: r.user_id,
            username: r.username,
            joined_at: r.joined_at,
        })
        .collect();

        // For 1:1 chats, set name to other user's username (Snapchat style)
        let chat_name = if !room.is_group && members.len() == 2 {
            members.iter()
                .find(|m| m.user_id != user_id)
                .map(|m| m.username.clone())
        } else {
            room.name
        };

        // Get last message
        let last_msg = sqlx::query!(
            r#"
            SELECT m.id, m.sender_id, u.username as sender_username,
                   m.message_type, m.content, m.media_url, m.media_thumbnail_url,
                   m.view_once, m.is_ephemeral, m.expires_at, m.created_at,
                   EXISTS(SELECT 1 FROM saved_messages WHERE message_id = m.id AND user_id = $2) as "is_saved!"
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.chat_room_id = $1 AND m.deleted_at IS NULL
            ORDER BY m.created_at DESC
            LIMIT 1
            "#,
            room.id,
            user_id
        )
        .fetch_optional(pool.as_ref())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .map(|r| MessageResponse {
            id: r.id,
            chat_room_id: room.id,
            sender_id: r.sender_id,
            sender_username: r.sender_username,
            message_type: r.message_type,
            content: r.content,
            media_url: r.media_url,
            media_thumbnail_url: r.media_thumbnail_url,
            view_once: r.view_once,
            is_ephemeral: r.is_ephemeral,
            expires_at: r.expires_at,
            created_at: r.created_at,
            is_viewed: false,
            is_read: false,
            is_saved: r.is_saved,
        });

        responses.push(ChatRoomResponse {
            id: room.id,
            name: chat_name,
            is_group: room.is_group,
            created_at: room.created_at,
            members,
            last_message: last_msg,
        });
    }

    Ok(Json(responses))
}

// Get messages for a chat room
pub async fn get_messages(
    State(state): State<Arc<crate::AppState>>,
    Path((user_id, chat_room_id)): Path<(Uuid, Uuid)>,
    Query(params): Query<GetMessagesQuery>,
) -> Result<Json<Vec<MessageResponse>>, StatusCode> {
    let pool = &state.pool;
    let limit = params.limit.unwrap_or(50).min(100);

    // Get before timestamp if provided
    let before_time = if let Some(before_id) = params.before {
        Some(sqlx::query!("SELECT created_at FROM messages WHERE id = $1", before_id)
            .fetch_one(pool.as_ref())
            .await
            .map_err(|_| StatusCode::BAD_REQUEST)?
            .created_at)
    } else {
        None
    };

    // Fetch messages with optional before filter
    let messages = sqlx::query!(
        r#"
        SELECT m.id, m.chat_room_id, m.sender_id, u.username as sender_username,
               m.message_type, m.content, m.media_url, m.media_thumbnail_url,
               m.view_once, m.is_ephemeral, m.expires_at, m.created_at,
               EXISTS(SELECT 1 FROM message_views WHERE message_id = m.id AND user_id = $2) as "is_viewed!",
               EXISTS(SELECT 1 FROM message_reads WHERE message_id = m.id AND user_id = $2) as "is_read!",
               EXISTS(SELECT 1 FROM saved_messages WHERE message_id = m.id AND user_id = $2) as "is_saved!"
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.chat_room_id = $1 AND m.deleted_at IS NULL
              AND ($3::timestamp IS NULL OR m.created_at < $3)
        ORDER BY m.created_at DESC
        LIMIT $4
        "#,
        chat_room_id,
        user_id,
        before_time,
        limit
    )
    .fetch_all(pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response: Vec<MessageResponse> = messages
        .into_iter()
        .map(|r| MessageResponse {
            id: r.id,
            chat_room_id: r.chat_room_id,
            sender_id: r.sender_id,
            sender_username: r.sender_username,
            message_type: r.message_type,
            content: r.content,
            media_url: r.media_url,
            media_thumbnail_url: r.media_thumbnail_url,
            view_once: r.view_once,
            is_ephemeral: r.is_ephemeral,
            expires_at: r.expires_at,
            created_at: r.created_at,
            is_viewed: r.is_viewed,
            is_read: r.is_read,
            is_saved: r.is_saved,
        })
        .collect();

    Ok(Json(response))
}

// Mark message as viewed (triggers auto-delete for view_once messages)
pub async fn mark_message_viewed(
    State(state): State<Arc<crate::AppState>>,
    Path((user_id, message_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, StatusCode> {
    let pool = &state.pool;

    // Insert view record (trigger will handle auto-delete)
    sqlx::query!(
        r#"
        INSERT INTO message_views (message_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (message_id, user_id) DO NOTHING
        "#,
        message_id,
        user_id
    )
    .execute(pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

// Save a message (prevents auto-delete)
pub async fn save_message(
    State(state): State<Arc<crate::AppState>>,
    Path((user_id, message_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, StatusCode> {
    let pool = &state.pool;

    sqlx::query!(
        r#"
        INSERT INTO saved_messages (message_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (message_id, user_id) DO NOTHING
        "#,
        message_id,
        user_id
    )
    .execute(pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

// Unsave a message (allows auto-delete again)
pub async fn unsave_message(
    State(state): State<Arc<crate::AppState>>,
    Path((user_id, message_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, StatusCode> {
    let pool = &state.pool;

    sqlx::query!(
        "DELETE FROM saved_messages WHERE message_id = $1 AND user_id = $2",
        message_id,
        user_id
    )
    .execute(pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}
