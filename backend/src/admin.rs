use axum::{
    async_trait,
    extract::{FromRequestParts, Json, Path, Query, State},
    http::{StatusCode, header, request::Parts},
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use jsonwebtoken::{decode, DecodingKey, Validation};
use std::sync::Arc;
use chrono::{DateTime, Utc, NaiveDate};

// Claims structure for JWT
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Claims {
    pub sub: Uuid,
    pub exp: usize,
}

// User info extracted from JWT and database
#[derive(Debug, Clone, Serialize)]
pub struct AuthUser {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub role: String,
}

// Admin user - requires admin role
#[derive(Debug, Clone)]
pub struct AdminUser(pub AuthUser);

// Extractor for authenticated users
#[async_trait]
impl FromRequestParts<Arc<crate::AppState>> for AuthUser
{
    type Rejection = (StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, state: &Arc<crate::AppState>) -> Result<Self, Self::Rejection> {
        let app_state = state;

        // Get Authorization header
        let auth_header = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|h| h.to_str().ok())
            .ok_or((StatusCode::UNAUTHORIZED, "Missing authorization header".to_string()))?;

        // Extract token (Bearer <token>)
        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or((StatusCode::UNAUTHORIZED, "Invalid authorization format".to_string()))?;

        // Decode JWT
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret("supersecret".as_ref()),
            &Validation::default(),
        )
        .map_err(|e| {
            eprintln!("JWT decode error: {:?}", e);
            (StatusCode::UNAUTHORIZED, "Invalid token".to_string())
        })?;

        let user_id = token_data.claims.sub;

        // Load user from database and check if banned
        let user = sqlx::query!(
            r#"
            SELECT u.id, u.username, u.email, u.role,
                   EXISTS(SELECT 1 FROM user_bans WHERE user_id = u.id AND active = true) as "is_banned!"
            FROM users u
            WHERE u.id = $1
            "#,
            user_id
        )
        .fetch_one(app_state.pool.as_ref())
        .await
        .map_err(|e| {
            eprintln!("User lookup error: {:?}", e);
            (StatusCode::UNAUTHORIZED, "User not found".to_string())
        })?;

        // Check if user is banned
        if user.is_banned {
            return Err((StatusCode::FORBIDDEN, "Your account has been banned".to_string()));
        }

        Ok(AuthUser {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
        })
    }
}

// Extractor for admin users
#[async_trait]
impl FromRequestParts<Arc<crate::AppState>> for AdminUser
{
    type Rejection = (StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, state: &Arc<crate::AppState>) -> Result<Self, Self::Rejection> {
        let user = AuthUser::from_request_parts(parts, state).await?;

        // Check if user is admin or moderator
        if user.role != "admin" && user.role != "moderator" {
            return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
        }

        Ok(AdminUser(user))
    }
}

// ============================================================================
// ADMIN API HANDLERS
// ============================================================================

// List all users with pagination and search
#[derive(Deserialize)]
pub struct UserListQuery {
    page: Option<i64>,
    per_page: Option<i64>,
    search: Option<String>,
    role: Option<String>,
}

#[derive(Serialize)]
pub struct UserInfo {
    id: Uuid,
    username: String,
    email: String,
    role: String,
    display_name: Option<String>,
    follower_count: Option<i32>,
    following_count: Option<i32>,
    story_count: Option<i32>,
    created_at: Option<chrono::NaiveDateTime>,
    is_banned: bool,
    ban_reason: Option<String>,
}

#[derive(Serialize)]
pub struct UserListResponse {
    users: Vec<UserInfo>,
    total: i64,
    page: i64,
    per_page: i64,
}

pub async fn list_users(
    admin: AdminUser,
    State(state): State<Arc<crate::AppState>>,
    Query(params): Query<UserListQuery>,
) -> Result<Json<UserListResponse>, (StatusCode, String)> {
    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(50).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let search_pattern = params.search.map(|s| format!("%{}%", s));

    // Build query based on filters
    let users = if let Some(ref search) = search_pattern {
        if let Some(ref role) = params.role {
            sqlx::query_as!(
                UserInfo,
                r#"
                SELECT
                    u.id, u.username, u.email, u.role, u.display_name,
                    u.follower_count, u.following_count, u.story_count,
                    u.created_at,
                    EXISTS(SELECT 1 FROM user_bans WHERE user_id = u.id AND active = true) as "is_banned!",
                    (SELECT reason FROM user_bans WHERE user_id = u.id AND active = true LIMIT 1) as ban_reason
                FROM users u
                WHERE (u.username ILIKE $1 OR u.email ILIKE $1) AND u.role = $2
                ORDER BY u.created_at DESC
                LIMIT $3 OFFSET $4
                "#,
                search,
                role,
                per_page,
                offset
            )
            .fetch_all(state.pool.as_ref())
            .await
        } else {
            sqlx::query_as!(
                UserInfo,
                r#"
                SELECT
                    u.id, u.username, u.email, u.role, u.display_name,
                    u.follower_count, u.following_count, u.story_count,
                    u.created_at,
                    EXISTS(SELECT 1 FROM user_bans WHERE user_id = u.id AND active = true) as "is_banned!",
                    (SELECT reason FROM user_bans WHERE user_id = u.id AND active = true LIMIT 1) as ban_reason
                FROM users u
                WHERE u.username ILIKE $1 OR u.email ILIKE $1
                ORDER BY u.created_at DESC
                LIMIT $2 OFFSET $3
                "#,
                search,
                per_page,
                offset
            )
            .fetch_all(state.pool.as_ref())
            .await
        }
    } else if let Some(ref role) = params.role {
        sqlx::query_as!(
            UserInfo,
            r#"
            SELECT
                u.id, u.username, u.email, u.role, u.display_name,
                u.follower_count, u.following_count, u.story_count,
                u.created_at,
                EXISTS(SELECT 1 FROM user_bans WHERE user_id = u.id AND active = true) as "is_banned!",
                (SELECT reason FROM user_bans WHERE user_id = u.id AND active = true LIMIT 1) as ban_reason
            FROM users u
            WHERE u.role = $1
            ORDER BY u.created_at DESC
            LIMIT $2 OFFSET $3
            "#,
            role,
            per_page,
            offset
        )
        .fetch_all(state.pool.as_ref())
        .await
    } else {
        sqlx::query_as!(
            UserInfo,
            r#"
            SELECT
                u.id, u.username, u.email, u.role, u.display_name,
                u.follower_count, u.following_count, u.story_count,
                u.created_at as "created_at: _",
                EXISTS(SELECT 1 FROM user_bans WHERE user_id = u.id AND active = true) as "is_banned!",
                (SELECT reason FROM user_bans WHERE user_id = u.id AND active = true LIMIT 1) as ban_reason
            FROM users u
            ORDER BY u.created_at DESC
            LIMIT $1 OFFSET $2
            "#,
            per_page,
            offset
        )
        .fetch_all(state.pool.as_ref())
        .await
    }
    .map_err(|e| {
        eprintln!("Database error: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch users".to_string())
    })?;

    // Get total count
    let total: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM users")
        .fetch_one(state.pool.as_ref())
        .await
        .map_err(|e| {
            eprintln!("Count error: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to count users".to_string())
        })?
        .unwrap_or(0);

    // Log admin action
    log_admin_action(
        &state,
        admin.0.id,
        "list_users".to_string(),
        None,
        None,
        None,
        serde_json::json!({ "page": page, "per_page": per_page }),
    ).await;

    Ok(Json(UserListResponse {
        users,
        total,
        page,
        per_page,
    }))
}

// Ban user
#[derive(Deserialize)]
pub struct BanUserInput {
    reason: String,
}

pub async fn ban_user(
    admin: AdminUser,
    State(state): State<Arc<crate::AppState>>,
    Path(user_id): Path<Uuid>,
    Json(input): Json<BanUserInput>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Prevent self-ban
    if admin.0.id == user_id {
        return Err((StatusCode::BAD_REQUEST, "Cannot ban yourself".to_string()));
    }

    // Check if target user is admin (prevent banning other admins)
    let target_user = sqlx::query!("SELECT role FROM users WHERE id = $1", user_id)
        .fetch_one(state.pool.as_ref())
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "User not found".to_string()))?;

    if target_user.role == "admin" && admin.0.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Cannot ban admin users".to_string()));
    }

    // Insert ban record
    sqlx::query!(
        "INSERT INTO user_bans (user_id, banned_by, reason) VALUES ($1, $2, $3)",
        user_id,
        admin.0.id,
        input.reason
    )
    .execute(state.pool.as_ref())
    .await
    .map_err(|e| {
        eprintln!("Ban error: {:?}", e);
        if e.to_string().contains("duplicate") {
            (StatusCode::CONFLICT, "User is already banned".to_string())
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to ban user".to_string())
        }
    })?;

    // Log admin action
    log_admin_action(
        &state,
        admin.0.id,
        "ban_user".to_string(),
        Some(user_id),
        Some("user".to_string()),
        Some(user_id),
        serde_json::json!({ "reason": input.reason }),
    ).await;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "User banned successfully"
    })))
}

// Unban user
pub async fn unban_user(
    admin: AdminUser,
    State(state): State<Arc<crate::AppState>>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    sqlx::query!(
    "UPDATE user_bans SET active = false, unbanned_at = NOW(), unbanned_by = $1 WHERE user_id = $2 AND active = true",
        admin.0.id,
        user_id
    )
    .execute(state.pool.as_ref())
    .await
    .map_err(|e| {
        eprintln!("Unban error: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to unban user".to_string())
    })?;

    // Log admin action
    log_admin_action(
        &state,
        admin.0.id,
        "unban_user".to_string(),
        Some(user_id),
        Some("user".to_string()),
        Some(user_id),
        serde_json::json!({}),
    ).await;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "User unbanned successfully"
    })))
}

// Change user role
#[derive(Deserialize)]
pub struct ChangeRoleInput {
    role: String,
}

pub async fn change_user_role(
    admin: AdminUser,
    State(state): State<Arc<crate::AppState>>,
    Path(user_id): Path<Uuid>,
    Json(input): Json<ChangeRoleInput>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Only admin can change roles
    if admin.0.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Only admins can change user roles".to_string()));
    }

    // Validate role
    if !["user", "admin", "moderator"].contains(&input.role.as_str()) {
        return Err((StatusCode::BAD_REQUEST, "Invalid role".to_string()));
    }

    // Prevent self-demotion
    if admin.0.id == user_id && input.role != "admin" {
        return Err((StatusCode::BAD_REQUEST, "Cannot change your own role".to_string()));
    }

    sqlx::query!(
        "UPDATE users SET role = $1 WHERE id = $2",
        input.role,
        user_id
    )
    .execute(state.pool.as_ref())
    .await
    .map_err(|e| {
        eprintln!("Role change error: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to change role".to_string())
    })?;

    // Log admin action
    log_admin_action(
        &state,
        admin.0.id,
        "change_role".to_string(),
        Some(user_id),
        Some("user".to_string()),
        Some(user_id),
        serde_json::json!({ "new_role": input.role }),
    ).await;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "User role updated successfully"
    })))
}

// Delete user (hard delete)
pub async fn delete_user(
    admin: AdminUser,
    State(state): State<Arc<crate::AppState>>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Only admin can delete users
    if admin.0.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Only admins can delete users".to_string()));
    }

    // Prevent self-deletion
    if admin.0.id == user_id {
        return Err((StatusCode::BAD_REQUEST, "Cannot delete yourself".to_string()));
    }

    sqlx::query!("DELETE FROM users WHERE id = $1", user_id)
        .execute(state.pool.as_ref())
        .await
        .map_err(|e| {
            eprintln!("Delete error: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to delete user".to_string())
        })?;

    // Log admin action
    log_admin_action(
        &state,
        admin.0.id,
        "delete_user".to_string(),
        Some(user_id),
        Some("user".to_string()),
        Some(user_id),
        serde_json::json!({}),
    ).await;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "User deleted successfully"
    })))
}

// Helper function to log admin actions
async fn log_admin_action(
    state: &Arc<crate::AppState>,
    admin_id: Uuid,
    action: String,
    target_user_id: Option<Uuid>,
    target_resource_type: Option<String>,
    target_resource_id: Option<Uuid>,
    details: serde_json::Value,
) {
    let _ = sqlx::query!(
        "INSERT INTO admin_logs (admin_id, action, target_user_id, target_resource_type, target_resource_id, details) VALUES ($1, $2, $3, $4, $5, $6)",
        admin_id,
        action,
        target_user_id,
        target_resource_type,
        target_resource_id,
        details
    )
    .execute(state.pool.as_ref())
    .await
    .map_err(|e| eprintln!("Failed to log admin action: {:?}", e));
}

// Get admin logs
#[derive(Deserialize)]
pub struct LogsQuery {
    page: Option<i64>,
    per_page: Option<i64>,
    action: Option<String>,
}

#[derive(Serialize)]
pub struct AdminLogEntry {
    id: Uuid,
    admin_id: Uuid,
    admin_username: Option<String>,
    action: String,
    target_user_id: Option<Uuid>,
    target_username: Option<String>,
    target_resource_type: Option<String>,
    target_resource_id: Option<Uuid>,
    details: serde_json::Value,
    created_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct LogsResponse {
    logs: Vec<AdminLogEntry>,
    total: i64,
    page: i64,
    per_page: i64,
}

pub async fn get_admin_logs(
    _admin: AdminUser,
    State(state): State<Arc<crate::AppState>>,
    Query(params): Query<LogsQuery>,
) -> Result<Json<LogsResponse>, (StatusCode, String)> {
    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(50).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let logs = if let Some(ref action) = params.action {
        sqlx::query_as!(
            AdminLogEntry,
            r#"
            SELECT
                al.id, al.admin_id, au.username as admin_username, al.action,
                al.target_user_id, tu.username as target_username,
                al.target_resource_type, al.target_resource_id,
                COALESCE(al.details, '{}'::jsonb) as "details!: serde_json::Value",
                al.created_at as "created_at: chrono::DateTime<chrono::Utc>"
            FROM admin_logs al
            LEFT JOIN users au ON al.admin_id = au.id
            LEFT JOIN users tu ON al.target_user_id = tu.id
            WHERE al.action = $1
            ORDER BY al.created_at DESC
            LIMIT $2 OFFSET $3
            "#,
            action,
            per_page,
            offset
        )
        .fetch_all(state.pool.as_ref())
        .await
    } else {
        sqlx::query_as!(
            AdminLogEntry,
            r#"
            SELECT
                al.id, al.admin_id, au.username as admin_username, al.action,
                al.target_user_id, tu.username as target_username,
                al.target_resource_type, al.target_resource_id,
                COALESCE(al.details, '{}'::jsonb) as "details!: serde_json::Value",
                al.created_at as "created_at: chrono::DateTime<chrono::Utc>"
            FROM admin_logs al
            LEFT JOIN users au ON al.admin_id = au.id
            LEFT JOIN users tu ON al.target_user_id = tu.id
            ORDER BY al.created_at DESC
            LIMIT $1 OFFSET $2
            "#,
            per_page,
            offset
        )
        .fetch_all(state.pool.as_ref())
        .await
    }
    .map_err(|e| {
        eprintln!("Logs error: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch logs".to_string())
    })?;

    let total: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM admin_logs")
        .fetch_one(state.pool.as_ref())
        .await
        .map_err(|e| {
            eprintln!("Count error: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to count logs".to_string())
        })?
        .unwrap_or(0);

    Ok(Json(LogsResponse {
        logs,
        total,
        page,
        per_page,
    }))
}

// ============================================================================
// ANALYTICS HANDLERS
// ============================================================================

#[derive(Serialize)]
pub struct AnalyticsSnapshot {
    date: NaiveDate,
    total_users: i32,
    new_users: i32,
    active_users: i32,
    total_stories: i32,
    new_stories: i32,
    total_messages: i32,
    new_messages: i32,
    total_follows: i32,
    new_follows: i32,
    total_ad_impressions: i32,
    total_ad_clicks: i32,
}

#[derive(Serialize)]
pub struct AnalyticsSummary {
    total_users: i64,
    total_stories: i64,
    total_messages: i64,
    total_follows: i64,
    total_ads: i64,
    active_ads: i64,
    total_ad_impressions: i64,
    total_ad_clicks: i64,
}

#[derive(Serialize)]
pub struct AnalyticsResponse {
    summary: AnalyticsSummary,
    daily_snapshots: Vec<AnalyticsSnapshot>,
}

#[derive(Deserialize)]
pub struct AnalyticsQuery {
    days: Option<i64>,
}

pub async fn get_analytics(
    _admin: AdminUser,
    State(state): State<Arc<crate::AppState>>,
    Query(params): Query<AnalyticsQuery>,
) -> Result<Json<AnalyticsResponse>, (StatusCode, String)> {
    let days = params.days.unwrap_or(30).clamp(1, 365);

    // Get summary stats
    let total_users: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM users")
        .fetch_one(state.pool.as_ref())
        .await
        .unwrap_or(Some(0))
        .unwrap_or(0);

    let total_stories: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM stories")
        .fetch_one(state.pool.as_ref())
        .await
        .unwrap_or(Some(0))
        .unwrap_or(0);

    let total_messages: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM messages")
        .fetch_one(state.pool.as_ref())
        .await
        .unwrap_or(Some(0))
        .unwrap_or(0);

    let total_follows: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM follows")
        .fetch_one(state.pool.as_ref())
        .await
        .unwrap_or(Some(0))
        .unwrap_or(0);

    let total_ads: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM advertisements")
        .fetch_one(state.pool.as_ref())
        .await
        .unwrap_or(Some(0))
        .unwrap_or(0);

    let active_ads: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM advertisements WHERE status = 'active'")
        .fetch_one(state.pool.as_ref())
        .await
        .unwrap_or(Some(0))
        .unwrap_or(0);

    let total_ad_impressions: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM ad_impressions")
        .fetch_one(state.pool.as_ref())
        .await
        .unwrap_or(Some(0))
        .unwrap_or(0);

    let total_ad_clicks: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM ad_impressions WHERE clicked = true")
        .fetch_one(state.pool.as_ref())
        .await
        .unwrap_or(Some(0))
        .unwrap_or(0);

    // Get daily snapshots (compute on-the-fly for now, can be pre-computed later)
    let days_i32 = days as i32;
    let daily_snapshots = sqlx::query!(
        r#"
        WITH date_series AS (
            SELECT generate_series(
                CURRENT_DATE - $1::integer,
                CURRENT_DATE,
                '1 day'::interval
            )::date as date
        )
        SELECT
            ds.date as "date!",
            COALESCE((SELECT COUNT(*)::int FROM users WHERE created_at::date <= ds.date), 0) as "total_users!",
            COALESCE((SELECT COUNT(*)::int FROM users WHERE created_at::date = ds.date), 0) as "new_users!",
            COALESCE((SELECT COUNT(DISTINCT user_id)::int FROM stories WHERE created_at::date = ds.date), 0) as "active_users!",
            COALESCE((SELECT COUNT(*)::int FROM stories WHERE created_at::date <= ds.date), 0) as "total_stories!",
            COALESCE((SELECT COUNT(*)::int FROM stories WHERE created_at::date = ds.date), 0) as "new_stories!",
            COALESCE((SELECT COUNT(*)::int FROM messages WHERE created_at::date <= ds.date), 0) as "total_messages!",
            COALESCE((SELECT COUNT(*)::int FROM messages WHERE created_at::date = ds.date), 0) as "new_messages!",
            COALESCE((SELECT COUNT(*)::int FROM follows WHERE created_at::date <= ds.date), 0) as "total_follows!",
            COALESCE((SELECT COUNT(*)::int FROM follows WHERE created_at::date = ds.date), 0) as "new_follows!",
            COALESCE((SELECT COUNT(*)::int FROM ad_impressions WHERE shown_at::date <= ds.date), 0) as "total_ad_impressions!",
            COALESCE((SELECT COUNT(*)::int FROM ad_impressions WHERE clicked = true AND clicked_at::date <= ds.date), 0) as "total_ad_clicks!"
        FROM date_series ds
        ORDER BY ds.date
        "#,
        days_i32
    )
    .fetch_all(state.pool.as_ref())
    .await
    .map_err(|e| {
        eprintln!("Analytics error: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch analytics".to_string())
    })?
    .into_iter()
    .map(|row| AnalyticsSnapshot {
        date: row.date,
        total_users: row.total_users,
        new_users: row.new_users,
        active_users: row.active_users,
        total_stories: row.total_stories,
        new_stories: row.new_stories,
        total_messages: row.total_messages,
        new_messages: row.new_messages,
        total_follows: row.total_follows,
        new_follows: row.new_follows,
        total_ad_impressions: row.total_ad_impressions,
        total_ad_clicks: row.total_ad_clicks,
    })
    .collect();

    Ok(Json(AnalyticsResponse {
        summary: AnalyticsSummary {
            total_users,
            total_stories,
            total_messages,
            total_follows,
            total_ads,
            active_ads,
            total_ad_impressions,
            total_ad_clicks,
        },
        daily_snapshots,
    }))
}

// ============================================================================
// ADVERTISEMENT HANDLERS
// ============================================================================

#[derive(Deserialize)]
pub struct CreateAdInput {
    title: String,
    description: Option<String>,
    image_url: Option<String>,
    link_url: Option<String>,
    target_impressions: i32,
}

#[derive(Serialize)]
pub struct AdCampaign {
    id: Uuid,
    title: String,
    description: Option<String>,
    image_url: Option<String>,
    link_url: Option<String>,
    target_impressions: i32,
    current_impressions: i32,
    click_count: i32,
    ctr_percentage: f64,
    status: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    expires_at: Option<DateTime<Utc>>,
    created_by_username: Option<String>,
}

pub async fn create_ad(
    admin: AdminUser,
    State(state): State<Arc<crate::AppState>>,
    Json(input): Json<CreateAdInput>,
) -> Result<Json<AdCampaign>, (StatusCode, String)> {
    println!("📢 Creating ad campaign: {} by {}", input.title, admin.0.username);
    println!("   Target impressions: {}", input.target_impressions);
    println!("   Image URL: {:?}", input.image_url);

    if input.target_impressions < 1 {
        return Err((StatusCode::BAD_REQUEST, "Target impressions must be at least 1".to_string()));
    }

    let ad = sqlx::query!(
        r#"
        INSERT INTO advertisements (created_by, title, description, image_url, link_url, target_impressions)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, title, description, image_url, link_url, target_impressions, current_impressions,
                  click_count, status, created_at, updated_at, expires_at
        "#,
        admin.0.id,
        input.title,
        input.description,
        input.image_url,
        input.link_url,
        input.target_impressions
    )
    .fetch_one(state.pool.as_ref())
    .await
    .map_err(|e| {
        eprintln!("Create ad error: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create advertisement".to_string())
    })?;

    let ctr = if ad.current_impressions > 0 {
        (ad.click_count as f64 / ad.current_impressions as f64) * 100.0
    } else {
        0.0
    };

    // Log admin action
    log_admin_action(
        &state,
        admin.0.id,
        "create_ad".to_string(),
        None,
        Some("advertisement".to_string()),
        Some(ad.id),
        serde_json::json!({ "title": input.title, "target_impressions": input.target_impressions }),
    ).await;

    println!("✅ Ad campaign created successfully: {} ({})", ad.title, ad.id);

    Ok(Json(AdCampaign {
        id: ad.id,
        title: ad.title,
        description: ad.description,
        image_url: ad.image_url,
        link_url: ad.link_url,
        target_impressions: ad.target_impressions,
        current_impressions: ad.current_impressions,
        click_count: ad.click_count,
        ctr_percentage: ctr,
        status: ad.status,
        created_at: ad.created_at.and_utc(),
        updated_at: ad.updated_at.and_utc(),
        expires_at: ad.expires_at.map(|dt| dt.and_utc()),
        created_by_username: Some(admin.0.username),
    }))
}

#[derive(Deserialize, Serialize)]
pub struct UpdateAdInput {
    title: Option<String>,
    description: Option<String>,
    image_url: Option<String>,
    link_url: Option<String>,
    status: Option<String>,
}

pub async fn update_ad(
    admin: AdminUser,
    State(state): State<Arc<crate::AppState>>,
    Path(ad_id): Path<Uuid>,
    Json(input): Json<UpdateAdInput>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Validate status if provided
    if let Some(ref status) = input.status {
        if !["active", "paused", "completed", "cancelled"].contains(&status.as_str()) {
            return Err((StatusCode::BAD_REQUEST, "Invalid status".to_string()));
        }
    }

    // Build dynamic update query
    let mut updates = Vec::new();
    let mut params = Vec::new();
    let mut param_count = 1;

    if let Some(title) = &input.title {
        updates.push(format!("title = ${}", param_count));
        params.push(title.clone());
        param_count += 1;
    }
    if let Some(description) = &input.description {
        updates.push(format!("description = ${}", param_count));
        params.push(description.clone());
        param_count += 1;
    }
    if let Some(image_url) = &input.image_url {
        updates.push(format!("image_url = ${}", param_count));
        params.push(image_url.clone());
        param_count += 1;
    }
    if let Some(link_url) = &input.link_url {
        updates.push(format!("link_url = ${}", param_count));
        params.push(link_url.clone());
        param_count += 1;
    }
    if let Some(status) = &input.status {
        updates.push(format!("status = ${}", param_count));
        params.push(status.clone());
        param_count += 1;
    }

    if updates.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "No fields to update".to_string()));
    }

    updates.push("updated_at = NOW()".to_string());

    // For simplicity, use individual update statements
    if let Some(ref title) = input.title {
        sqlx::query!("UPDATE advertisements SET title = $1, updated_at = NOW() WHERE id = $2", title, ad_id)
            .execute(state.pool.as_ref())
            .await
            .map_err(|e| {
                eprintln!("Update error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update advertisement".to_string())
            })?;
    }
    if let Some(ref description) = input.description {
        sqlx::query!("UPDATE advertisements SET description = $1, updated_at = NOW() WHERE id = $2", description, ad_id)
            .execute(state.pool.as_ref())
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update advertisement".to_string()))?;
    }
    if let Some(ref image_url) = input.image_url {
        sqlx::query!("UPDATE advertisements SET image_url = $1, updated_at = NOW() WHERE id = $2", image_url, ad_id)
            .execute(state.pool.as_ref())
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update advertisement".to_string()))?;
    }
    if let Some(ref link_url) = input.link_url {
        sqlx::query!("UPDATE advertisements SET link_url = $1, updated_at = NOW() WHERE id = $2", link_url, ad_id)
            .execute(state.pool.as_ref())
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update advertisement".to_string()))?;
    }
    if let Some(ref status) = input.status {
        sqlx::query!("UPDATE advertisements SET status = $1, updated_at = NOW() WHERE id = $2", status, ad_id)
            .execute(state.pool.as_ref())
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update advertisement".to_string()))?;
    }

    // Log admin action
    log_admin_action(
        &state,
        admin.0.id,
        "update_ad".to_string(),
        None,
        Some("advertisement".to_string()),
        Some(ad_id),
        serde_json::json!(input),
    ).await;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Advertisement updated successfully"
    })))
}

pub async fn list_ads(
    _admin: AdminUser,
    State(state): State<Arc<crate::AppState>>,
    Query(params): Query<UserListQuery>,
) -> Result<Json<Vec<AdCampaign>>, (StatusCode, String)> {
    let ads = sqlx::query!(
        r#"
        SELECT
            a.id, a.title, a.description, a.image_url, a.link_url,
            a.target_impressions, a.current_impressions, a.click_count,
            a.status, a.created_at, a.updated_at, a.expires_at,
            u.username as "created_by_username?"
        FROM advertisements a
        LEFT JOIN users u ON a.created_by = u.id
        ORDER BY a.created_at DESC
        "#
    )
    .fetch_all(state.pool.as_ref())
    .await
    .map_err(|e| {
        eprintln!("List ads error: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch advertisements".to_string())
    })?
    .into_iter()
    .map(|row| {
        let ctr = if row.current_impressions > 0 {
            (row.click_count as f64 / row.current_impressions as f64) * 100.0
        } else {
            0.0
        };

        AdCampaign {
            id: row.id,
            title: row.title,
            description: row.description,
            image_url: row.image_url,
            link_url: row.link_url,
            target_impressions: row.target_impressions,
            current_impressions: row.current_impressions,
            click_count: row.click_count,
            ctr_percentage: ctr,
            status: row.status,
            created_at: row.created_at.and_utc(),
            updated_at: row.updated_at.and_utc(),
            expires_at: row.expires_at.map(|dt| dt.and_utc()),
            created_by_username: row.created_by_username,
        }
    })
    .collect();

    Ok(Json(ads))
}

pub async fn delete_ad(
    admin: AdminUser,
    State(state): State<Arc<crate::AppState>>,
    Path(ad_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    sqlx::query!("DELETE FROM advertisements WHERE id = $1", ad_id)
        .execute(state.pool.as_ref())
        .await
        .map_err(|e| {
            eprintln!("Delete ad error: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to delete advertisement".to_string())
        })?;

    // Log admin action
    log_admin_action(
        &state,
        admin.0.id,
        "delete_ad".to_string(),
        None,
        Some("advertisement".to_string()),
        Some(ad_id),
        serde_json::json!({}),
    ).await;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Advertisement deleted successfully"
    })))
}

// ============================================================================
// PUBLIC AD SERVING ENDPOINTS (for displaying ads to users)
// ============================================================================

#[derive(Serialize)]
pub struct AdToShow {
    id: Uuid,
    title: String,
    description: Option<String>,
    image_url: Option<String>,
    link_url: Option<String>,
}

// Get next ad to show to a user
pub async fn get_next_ad(
    State(state): State<Arc<crate::AppState>>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Option<AdToShow>>, (StatusCode, String)> {
    // Find active ads that user hasn't seen yet, ordered by priority (least impressions first)
    let ad = sqlx::query!(
        r#"
        SELECT a.id, a.title, a.description, a.image_url, a.link_url
        FROM advertisements a
        WHERE a.status = 'active'
          AND a.current_impressions < a.target_impressions
          AND NOT EXISTS (
              SELECT 1 FROM ad_impressions ai
              WHERE ai.ad_id = a.id AND ai.user_id = $1
          )
        ORDER BY a.current_impressions ASC, RANDOM()
        LIMIT 1
        "#,
        user_id
    )
    .fetch_optional(state.pool.as_ref())
    .await
    .map_err(|e| {
        eprintln!("Get next ad error: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch ad".to_string())
    })?;

    if let Some(ad) = ad {
        Ok(Json(Some(AdToShow {
            id: ad.id,
            title: ad.title,
            description: ad.description,
            image_url: ad.image_url,
            link_url: ad.link_url,
        })))
    } else {
        Ok(Json(None))
    }
}

// Record ad impression (when ad is shown to user)
pub async fn record_ad_impression(
    State(state): State<Arc<crate::AppState>>,
    Path((ad_id, user_id)): Path<(Uuid, Uuid)>,
    headers: axum::http::HeaderMap,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Extract device type from User-Agent
    let user_agent = headers
        .get(axum::http::header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");

    let device_type = if user_agent.contains("Mobile") || user_agent.contains("Android") || user_agent.contains("iPhone") {
        "mobile"
    } else if user_agent.contains("Tablet") || user_agent.contains("iPad") {
        "tablet"
    } else {
        "desktop"
    };

    // Extract location from CloudFlare headers (if using CF) or X-Forwarded-For
    let country = headers
        .get("CF-IPCountry")
        .and_then(|v| v.to_str().ok())
        .map(|c| c.chars().take(2).collect::<String>())
        .unwrap_or("un".to_string());

    let city = headers
        .get("CF-IPCity")
        .and_then(|v| v.to_str().ok());

    // Get user demographics
    let user_demo = sqlx::query!(
        r#"
        SELECT birthdate, gender
        FROM users
        WHERE id = $1
        "#,
        user_id
    )
    .fetch_optional(state.pool.as_ref())
    .await
    .ok()
    .flatten();

    let (age_range, gender) = if let Some(demo) = user_demo {
        let age_range = if let Some(birthdate) = demo.birthdate {
            sqlx::query_scalar!(
                "SELECT get_age_range($1::DATE)",
                birthdate
            )
            .fetch_one(state.pool.as_ref())
            .await
            .ok()
            .flatten()
        } else {
            None
        };
        (age_range, demo.gender)
    } else {
        (None, None)
    };

    // Insert impression record with analytics data
    sqlx::query!(
        r#"
        INSERT INTO ad_impressions (
            ad_id, user_id, country, city, device_type, user_age_range, user_gender
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
        "#,
        ad_id,
        user_id,
        country,
        city,
        device_type,
        age_range,
        gender
    )
    .execute(state.pool.as_ref())
    .await
    .map_err(|e| {
        eprintln!("Record impression error: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to record impression".to_string())
    })?;

    // Update location performance aggregates
    sqlx::query!(
        r#"
        INSERT INTO ad_performance_by_location (ad_id, country, city, impressions)
        VALUES ($1, $2, COALESCE($3, ''), 1)
        ON CONFLICT (ad_id, country, city) DO UPDATE
        SET impressions = ad_performance_by_location.impressions + 1,
            ctr = CASE
                WHEN ad_performance_by_location.impressions + 1 > 0
                THEN (ad_performance_by_location.clicks::DECIMAL / (ad_performance_by_location.impressions + 1)) * 100
                ELSE 0
            END,
            last_updated = NOW()
        "#,
        ad_id,
        country,
        city
    )
    .execute(state.pool.as_ref())
    .await
    .ok();

    Ok(Json(serde_json::json!({
        "success": true
    })))
}

// Record ad click
pub async fn record_ad_click(
    State(state): State<Arc<crate::AppState>>,
    Path((ad_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Get the impression country/city for updating location aggregates
    let impression = sqlx::query!(
        "SELECT country, city FROM ad_impressions WHERE ad_id = $1 AND user_id = $2",
        ad_id,
        user_id
    )
    .fetch_optional(state.pool.as_ref())
    .await
    .ok()
    .flatten();

    // Update impression record to mark as clicked
    sqlx::query!(
        "UPDATE ad_impressions SET clicked = true, clicked_at = NOW() WHERE ad_id = $1 AND user_id = $2",
        ad_id,
        user_id
    )
    .execute(state.pool.as_ref())
    .await
    .map_err(|e| {
        eprintln!("Record click error: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to record click".to_string())
    })?;

    // Update location performance aggregates (increment clicks)
    if let Some(imp) = impression {
        sqlx::query!(
            r#"
            INSERT INTO ad_performance_by_location (ad_id, country, city, clicks)
            VALUES ($1, $2, COALESCE($3, ''), 1)
            ON CONFLICT (ad_id, country, city) DO UPDATE
            SET clicks = ad_performance_by_location.clicks + 1,
                ctr = CASE
                    WHEN ad_performance_by_location.impressions > 0
                    THEN ((ad_performance_by_location.clicks + 1)::DECIMAL / ad_performance_by_location.impressions) * 100
                    ELSE 0
                END,
                last_updated = NOW()
            "#,
            ad_id,
            imp.country,
            imp.city
        )
        .execute(state.pool.as_ref())
        .await
        .ok();
    }

    Ok(Json(serde_json::json!({
        "success": true
    })))
}

// ============================================================================
// PUBLIC AD CREATION ENDPOINTS (Self-service advertising)
// ============================================================================

#[derive(Deserialize)]
pub struct PublicCreateAdInput {
    pub title: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub link_url: Option<String>,
    pub target_impressions: i32,
    pub package_type: String,
    pub price: f64,
    pub contact_email: String,
}

#[derive(Serialize)]
pub struct PublicCreateAdResponse {
    pub ad_id: Uuid,
    pub status: String,
}

// Public endpoint for creating ads (requires authentication)
pub async fn create_ad_public(
    State(state): State<Arc<crate::AppState>>,
    headers: axum::http::HeaderMap,
    Json(input): Json<PublicCreateAdInput>,
) -> Result<Json<PublicCreateAdResponse>, (StatusCode, String)> {

    // Debug: print raw Authorization header
    let auth_header = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or((StatusCode::UNAUTHORIZED, "Missing authorization header".to_string()))?;
    println!("[DEBUG] Authorization header: {}", auth_header);

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or((StatusCode::UNAUTHORIZED, "Invalid authorization format".to_string()))?;
    println!("[DEBUG] JWT token: {}", token);

    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());
    let token_data = match decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::default(),
    ) {
        Ok(data) => {
            println!("[DEBUG] Decoded claims: sub={}, exp={}", data.claims.sub, data.claims.exp);
            data
        },
        Err(e) => {
            eprintln!("[ERROR] JWT decode error: {:?}", e);
            return Err((StatusCode::UNAUTHORIZED, format!("Invalid token: {:?}", e)));
        }
    };

    let user_id = token_data.claims.sub;
    println!("📢 Public ad creation: {} by user {}", input.title, user_id);

    // Create ad with pending_payment status
    let ad = sqlx::query!(
        r#"
        INSERT INTO advertisements (
            created_by, title, description, image_url, link_url,
            target_impressions, status, package_type, price, contact_email
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'pending_payment', $7, $8, $9)
        RETURNING id
        "#,
        user_id,
        input.title,
        input.description,
        input.image_url,
        input.link_url,
        input.target_impressions,
        input.package_type,
        input.price,
        input.contact_email
    )
    .fetch_one(state.pool.as_ref())
    .await
    .map_err(|e| {
        eprintln!("Create public ad error: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create advertisement".to_string())
    })?;

    Ok(Json(PublicCreateAdResponse {
        ad_id: ad.id,
        status: "pending_payment".to_string(),
    }))
}

#[derive(Serialize)]
pub struct CheckoutSessionResponse {
    pub session_id: String,
}

// Create Stripe checkout session for ad payment
pub async fn create_checkout_session(
    State(state): State<Arc<crate::AppState>>,
    Path(ad_id): Path<Uuid>,
) -> Result<Json<CheckoutSessionResponse>, (StatusCode, String)> {
    // Get ad details
    let ad = sqlx::query!(
        r#"
        SELECT title, price, package_type FROM advertisements
        WHERE id = $1 AND status = 'pending_payment'
        "#,
        ad_id
    )
    .fetch_one(state.pool.as_ref())
    .await
    .map_err(|_| (StatusCode::NOT_FOUND, "Ad not found or already paid".to_string()))?;

    let price = ad.price.ok_or((StatusCode::BAD_REQUEST, "Ad has no price set".to_string()))?;

    // In production, you would create a real Stripe checkout session here
    // For now, in development mode, auto-approve for testing
    let stripe_secret = std::env::var("STRIPE_SECRET_KEY").unwrap_or_else(|_| "sk_test_mock".to_string());

    if stripe_secret == "sk_test_mock" {
        // Development mode - just mark as paid
        sqlx::query!(
            "UPDATE advertisements SET status = 'pending_approval', paid_at = NOW() WHERE id = $1",
            ad_id
        )
        .execute(state.pool.as_ref())
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update ad".to_string()))?;

        return Ok(Json(CheckoutSessionResponse {
            session_id: format!("cs_test_mock_{}", ad_id),
        }));
    }

    // TODO: Implement real Stripe checkout session creation when you have Stripe configured
    // You'll need to add stripe-rust dependency and create a real checkout session

    Ok(Json(CheckoutSessionResponse {
        session_id: format!("cs_dev_{}", ad_id),
    }))
}

// Stripe webhook handler
pub async fn stripe_webhook(
    State(state): State<Arc<crate::AppState>>,
    headers: axum::http::HeaderMap,
    body: String,
) -> Result<StatusCode, StatusCode> {
    let _signature = headers
        .get("stripe-signature")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::BAD_REQUEST)?;

    let _webhook_secret = std::env::var("STRIPE_WEBHOOK_SECRET")
        .unwrap_or_else(|_| "whsec_test".to_string());

    // TODO: Verify Stripe signature in production
    // For now, just parse the event

    let event: serde_json::Value = serde_json::from_str(&body)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let event_type = event["type"].as_str().unwrap_or("");

    match event_type {
        "checkout.session.completed" => {
            // Extract ad_id from metadata
            if let Some(ad_id_str) = event["data"]["object"]["metadata"]["ad_id"].as_str() {
                if let Ok(ad_id) = Uuid::parse_str(ad_id_str) {
                    // Mark ad as paid and move to pending_approval
                    sqlx::query!(
                        r#"
                        UPDATE advertisements
                        SET status = 'pending_approval', paid_at = NOW()
                        WHERE id = $1
                        "#,
                        ad_id
                    )
                    .execute(state.pool.as_ref())
                    .await
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

                    println!("✅ Ad {} payment confirmed, moved to pending_approval", ad_id);
                }
            }
        }
        _ => {
            println!("Unhandled Stripe event: {}", event_type);
        }
    }

    Ok(StatusCode::OK)
}

// Admin approval endpoint
pub async fn approve_ad(
    State(state): State<Arc<crate::AppState>>,
    _admin: AdminUser,
    Path(ad_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Update ad status to active
    sqlx::query!(
        "UPDATE advertisements SET status = 'active', start_date = NOW() WHERE id = $1",
        ad_id
    )
    .execute(&*state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Log admin action
    sqlx::query!(
        "INSERT INTO admin_logs (admin_id, action, target_resource_type, target_resource_id) VALUES ($1, 'approve_ad', 'advertisement', $2)",
        _admin.0.id,
        ad_id
    )
    .execute(&*state.pool)
    .await
    .ok();

    Ok(StatusCode::OK)
}

// Admin rejection endpoint
pub async fn reject_ad(
    State(state): State<Arc<crate::AppState>>,
    _admin: AdminUser,
    Path(ad_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Update ad status to rejected
    sqlx::query!(
        "UPDATE advertisements SET status = 'rejected' WHERE id = $1",
        ad_id
    )
    .execute(&*state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Log admin action
    sqlx::query!(
        "INSERT INTO admin_logs (admin_id, action, target_resource_type, target_resource_id) VALUES ($1, 'reject_ad', 'advertisement', $2)",
        _admin.0.id,
        ad_id
    )
    .execute(&*state.pool)
    .await
    .ok();

    Ok(StatusCode::OK)
}

// ============================================================================
// AD ANALYTICS ENDPOINTS
// ============================================================================

#[derive(Serialize)]
pub struct AdLocationAnalytics {
    country: String,
    city: Option<String>,
    impressions: i32,
    clicks: i32,
    ctr: f64,
}

// Get ad performance by location
pub async fn get_ad_location_analytics(
    State(state): State<Arc<crate::AppState>>,
    _admin: AdminUser,
    Path(ad_id): Path<Uuid>,
) -> Result<Json<Vec<AdLocationAnalytics>>, (StatusCode, String)> {
    let analytics = sqlx::query_as!(
        AdLocationAnalytics,
        r#"
        SELECT
            country,
            NULLIF(city, '') as city,
            impressions as "impressions!",
            clicks as "clicks!",
            ctr::DOUBLE PRECISION as "ctr!"
        FROM ad_performance_by_location
        WHERE ad_id = $1
        ORDER BY impressions DESC
        LIMIT 50
        "#,
        ad_id
    )
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(analytics))
}

#[derive(Serialize)]
pub struct AdDemographicsAnalytics {
    device_type: Option<String>,
    age_range: Option<String>,
    gender: Option<String>,
    impressions: i64,
    clicks: i64,
    ctr: f64,
}

// Get ad performance by demographics
pub async fn get_ad_demographics_analytics(
    State(state): State<Arc<crate::AppState>>,
    _admin: AdminUser,
    Path(ad_id): Path<Uuid>,
) -> Result<Json<Vec<AdDemographicsAnalytics>>, (StatusCode, String)> {
    let analytics = sqlx::query_as!(
        AdDemographicsAnalytics,
        r#"
        SELECT
            device_type,
            user_age_range as age_range,
            user_gender as gender,
            COUNT(*) as "impressions!",
            COUNT(*) FILTER (WHERE clicked = true) as "clicks!",
            (CASE
                WHEN COUNT(*) > 0
                THEN (COUNT(*) FILTER (WHERE clicked = true)::DECIMAL / COUNT(*)) * 100
                ELSE 0
            END)::DOUBLE PRECISION as "ctr!"
        FROM ad_impressions
        WHERE ad_id = $1
        GROUP BY device_type, user_age_range, user_gender
        ORDER BY COUNT(*) DESC
        "#,
        ad_id
    )
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(analytics))
}
