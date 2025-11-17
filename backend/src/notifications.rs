use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::AppState;

#[derive(Deserialize)]
pub struct LimitQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    50
}

#[derive(Serialize)]
pub struct Notification {
    pub id: String,
    pub user_id: String,
    #[serde(rename = "type")]
    pub notification_type: String,
    pub from_user_id: Option<String>,
    pub from_username: Option<String>,
    pub from_avatar_url: Option<String>,
    pub story_id: Option<String>,
    pub comment_id: Option<String>,
    pub message: Option<String>,
    pub is_read: bool,
    pub created_at: String,
}

#[derive(Serialize)]
pub struct NotificationResponse {
    pub notifications: Vec<Notification>,
    pub unread_count: i64,
}

// Get user's notifications
pub async fn get_notifications(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
    Query(params): Query<LimitQuery>,
) -> Result<Json<NotificationResponse>, StatusCode> {
    let user_uuid = uuid::Uuid::parse_str(&user_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let limit = params.limit.min(100);

    // Get notifications with user info
    let notifications = sqlx::query!(
        r#"
        SELECT 
            n.id,
            n.user_id,
            n.type,
            n.from_user_id,
            u.username as from_username,
            u.avatar_url as from_avatar_url,
            n.story_id,
            n.comment_id,
            n.message,
            n.is_read,
            n.created_at
        FROM notifications n
        LEFT JOIN users u ON n.from_user_id = u.id
        WHERE n.user_id = $1
        ORDER BY n.created_at DESC
        LIMIT $2
        "#,
        user_uuid,
        limit
    )
    .fetch_all(&*state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Get unread count
    let unread_count = sqlx::query!(
        "SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE",
        user_uuid
    )
    .fetch_one(&*state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .count
    .unwrap_or(0);

    let result = notifications
        .into_iter()
        .map(|n| Notification {
            id: n.id.to_string(),
            user_id: n.user_id.to_string(),
            notification_type: n.r#type,
            from_user_id: n.from_user_id.map(|id| id.to_string()),
            from_username: Some(n.from_username),
            from_avatar_url: n.from_avatar_url,
            story_id: n.story_id.map(|id| id.to_string()),
            comment_id: n.comment_id.map(|id| id.to_string()),
            message: n.message,
            is_read: n.is_read.unwrap_or(false),
            created_at: n.created_at.map(|t| t.to_string()).unwrap_or_default(),
        })
        .collect();

    Ok(Json(NotificationResponse {
        notifications: result,
        unread_count,
    }))
}

// Mark notification as read
pub async fn mark_notification_read(
    State(state): State<Arc<AppState>>,
    Path((user_id, notification_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let user_uuid = uuid::Uuid::parse_str(&user_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let notification_uuid = uuid::Uuid::parse_str(&notification_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    sqlx::query!(
        "UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2",
        notification_uuid,
        user_uuid
    )
    .execute(&*state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({ "success": true })))
}

// Mark all notifications as read
pub async fn mark_all_notifications_read(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let user_uuid = uuid::Uuid::parse_str(&user_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    sqlx::query!(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE",
        user_uuid
    )
    .execute(&*state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({ "success": true })))
}

// Delete notification
pub async fn delete_notification(
    State(state): State<Arc<AppState>>,
    Path((user_id, notification_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let user_uuid = uuid::Uuid::parse_str(&user_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let notification_uuid = uuid::Uuid::parse_str(&notification_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    sqlx::query!(
        "DELETE FROM notifications WHERE id = $1 AND user_id = $2",
        notification_uuid,
        user_uuid
    )
    .execute(&*state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({ "success": true })))
}

// Get unread notification count
pub async fn get_unread_count(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let user_uuid = uuid::Uuid::parse_str(&user_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let count = sqlx::query!(
        "SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE",
        user_uuid
    )
    .fetch_one(&*state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .count
    .unwrap_or(0);

    Ok(Json(serde_json::json!({ "unread_count": count })))
}
