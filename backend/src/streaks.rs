use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::sync::Arc;

use crate::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct StreakInfo {
    pub current_streak: i32,
    pub longest_streak: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_interaction_date: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct StreakResponse {
    pub success: bool,
    pub streak: StreakInfo,
}

/// Update streak when a message is sent between two users
/// POST /api/streaks/update/:user1_id/:user2_id
pub async fn update_streak(
    State(state): State<Arc<AppState>>,
    Path((user1_id, user2_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<StreakResponse>, StatusCode> {
    let result = sqlx::query_as::<_, (i32, i32)>(
        "SELECT * FROM update_streak($1, $2)"
    )
    .bind(user1_id)
    .bind(user2_id)
    .fetch_one(state.pool.as_ref())
    .await
    .map_err(|e| {
        eprintln!("Failed to update streak: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(StreakResponse {
        success: true,
        streak: StreakInfo {
            current_streak: result.0,
            longest_streak: result.1,
            last_interaction_date: None,
        },
    }))
}

/// Get streak information between two users
/// GET /api/streaks/:user1_id/:user2_id
pub async fn get_streak(
    State(state): State<Arc<AppState>>,
    Path((user1_id, user2_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<StreakResponse>, StatusCode> {
    let result = sqlx::query_as::<_, (i32, i32, chrono::NaiveDate)>(
        "SELECT * FROM get_streak($1, $2)"
    )
    .bind(user1_id)
    .bind(user2_id)
    .fetch_optional(state.pool.as_ref())
    .await
    .map_err(|e| {
        eprintln!("Failed to get streak: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if let Some(streak) = result {
        Ok(Json(StreakResponse {
            success: true,
            streak: StreakInfo {
                current_streak: streak.0,
                longest_streak: streak.1,
                last_interaction_date: Some(streak.2.to_string()),
            },
        }))
    } else {
        // No streak yet
        Ok(Json(StreakResponse {
            success: true,
            streak: StreakInfo {
                current_streak: 0,
                longest_streak: 0,
                last_interaction_date: None,
            },
        }))
    }
}

/// Get all streaks for a specific user
/// GET /api/streaks/user/:user_id
pub async fn get_user_streaks(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Vec<UserStreakInfo>>, StatusCode> {
    let streaks = sqlx::query_as::<_, UserStreakInfo>(
        r#"
        SELECT 
            CASE 
                WHEN us.user1_id = $1 THEN us.user2_id
                ELSE us.user1_id
            END as other_user_id,
            CASE 
                WHEN us.user1_id = $1 THEN u2.username
                ELSE u1.username
            END as other_username,
            CASE 
                WHEN us.user1_id = $1 THEN u2.avatar_url
                ELSE u1.avatar_url
            END as other_avatar_url,
            us.current_streak,
            us.longest_streak,
            us.last_interaction_date::TEXT as last_interaction_date
        FROM user_streaks us
        JOIN users u1 ON u1.id = us.user1_id
        JOIN users u2 ON u2.id = us.user2_id
        WHERE us.user1_id = $1 OR us.user2_id = $1
        ORDER BY us.current_streak DESC
        LIMIT 50
        "#
    )
    .bind(user_id)
    .fetch_all(state.pool.as_ref())
    .await
    .map_err(|e| {
        eprintln!("Failed to get user streaks: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(streaks))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UserStreakInfo {
    pub other_user_id: Uuid,
    pub other_username: String,
    pub other_avatar_url: Option<String>,
    pub current_streak: i32,
    pub longest_streak: i32,
    pub last_interaction_date: String,
}
