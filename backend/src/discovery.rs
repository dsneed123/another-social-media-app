use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::AppState;

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: String,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

#[derive(Deserialize)]
pub struct LimitQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    20
}

#[derive(Serialize)]
pub struct UserSearchResult {
    pub id: String,
    pub username: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
    pub follower_count: Option<i32>,
    pub is_following: bool,
}

// Search users by username, display name, or bio
pub async fn search_users(
    State(state): State<Arc<AppState>>,
    Path(viewer_id): Path<String>,
    Query(params): Query<SearchQuery>,
) -> Result<Json<Vec<UserSearchResult>>, StatusCode> {
    let viewer_uuid = uuid::Uuid::parse_str(&viewer_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let search_term = format!("%{}%", params.q.to_lowercase());
    let limit = params.limit.min(50); // Cap at 50 results

    let users = sqlx::query!(
        r#"
        SELECT 
            u.id,
            u.username,
            u.display_name,
            u.avatar_url,
            u.bio,
            COUNT(DISTINCT f.follower_id) as follower_count,
            EXISTS(
                SELECT 1 FROM follows 
                WHERE follower_id = $1 AND following_id = u.id
            ) as "is_following!"
        FROM users u
        LEFT JOIN follows f ON u.id = f.following_id
        WHERE 
            u.id != $1 AND (
                LOWER(u.username) LIKE $2 OR
                LOWER(u.display_name) LIKE $2 OR
                LOWER(u.bio) LIKE $2
            )
        GROUP BY u.id
        ORDER BY follower_count DESC, u.username ASC
        LIMIT $3
        "#,
        viewer_uuid,
        search_term,
        limit
    )
    .fetch_all(&*state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let results = users
        .into_iter()
        .map(|u| UserSearchResult {
            id: u.id.to_string(),
            username: u.username,
            display_name: u.display_name,
            avatar_url: u.avatar_url,
            bio: u.bio,
            follower_count: u.follower_count.map(|c| c as i32),
            is_following: u.is_following,
        })
        .collect();

    Ok(Json(results))
}

// Get popular/suggested users (from materialized view)
pub async fn get_popular_users(
    State(state): State<Arc<AppState>>,
    Path(viewer_id): Path<String>,
    Query(params): Query<LimitQuery>,
) -> Result<Json<Vec<UserSearchResult>>, StatusCode> {
    let viewer_uuid = uuid::Uuid::parse_str(&viewer_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let limit = params.limit.min(50);

    let users = sqlx::query!(
        r#"
        SELECT 
            p.id,
            p.username,
            p.display_name,
            p.avatar_url,
            p.bio,
            p.follower_count as "follower_count!",
            EXISTS(
                SELECT 1 FROM follows 
                WHERE follower_id = $1 AND following_id = p.id
            ) as "is_following!"
        FROM popular_users p
        WHERE p.id != $1
        LIMIT $2
        "#,
        viewer_uuid,
        limit
    )
    .fetch_all(&*state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let results = users
        .into_iter()
        .map(|u| UserSearchResult {
            id: u.id.map(|id| id.to_string()).unwrap_or_default(),
            username: u.username.unwrap_or_else(|| "unknown".to_string()),
            display_name: u.display_name,
            avatar_url: u.avatar_url,
            bio: u.bio,
            follower_count: Some(u.follower_count as i32),
            is_following: u.is_following,
        })
        .collect();

    Ok(Json(results))
}

// Get suggested users based on mutual follows
pub async fn get_suggested_users(
    State(state): State<Arc<AppState>>,
    Path(viewer_id): Path<String>,
    Query(params): Query<LimitQuery>,
) -> Result<Json<Vec<UserSearchResult>>, StatusCode> {
    let viewer_uuid = uuid::Uuid::parse_str(&viewer_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let limit = params.limit.min(50);

    // Find users followed by people the viewer follows, but not followed by viewer
    let users = sqlx::query!(
        r#"
        SELECT 
            u.id,
            u.username,
            u.display_name,
            u.avatar_url,
            u.bio,
            COUNT(DISTINCT f1.follower_id) as follower_count,
            false as "is_following!"
        FROM users u
        JOIN follows f2 ON u.id = f2.following_id
        JOIN follows f1 ON f2.follower_id = f1.following_id
        LEFT JOIN follows direct ON direct.follower_id = $1 AND direct.following_id = u.id
        WHERE 
            f1.follower_id = $1
            AND u.id != $1
            AND direct.id IS NULL
        GROUP BY u.id
        ORDER BY follower_count DESC, u.username ASC
        LIMIT $2
        "#,
        viewer_uuid,
        limit
    )
    .fetch_all(&*state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let results = users
        .into_iter()
        .map(|u| UserSearchResult {
            id: u.id.to_string(),
            username: u.username,
            display_name: u.display_name,
            avatar_url: u.avatar_url,
            bio: u.bio,
            follower_count: u.follower_count.map(|c| c as i32),
            is_following: u.is_following,
        })
        .collect();

    Ok(Json(results))
}

// Upload profile picture
#[derive(Deserialize)]
pub struct UpdateAvatarRequest {
    pub avatar_url: String,
}

pub async fn update_avatar(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
    Json(payload): Json<UpdateAvatarRequest>,
) -> Result<StatusCode, StatusCode> {
    let user_uuid = uuid::Uuid::parse_str(&user_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    sqlx::query!(
        "UPDATE users SET avatar_url = $1 WHERE id = $2",
        payload.avatar_url,
        user_uuid
    )
    .execute(&*state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

// Refresh popular users materialized view (admin/cron endpoint)
pub async fn refresh_popular_users_view(
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query!("SELECT refresh_popular_users()")
        .execute(&*state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}
