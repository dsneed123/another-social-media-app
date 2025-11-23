use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::AppState;
use chrono::Utc;

#[derive(Deserialize)]
pub struct FeedQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
}

fn default_limit() -> i64 {
    20
}

#[derive(Serialize)]
pub struct PersonalizedStory {
    pub id: String,
    pub user_id: String,
    pub username: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub media_url: String,
    pub media_type: String,
    pub caption: Option<String>,
    pub created_at: String,
    pub view_count: Option<i32>,
    pub like_count: Option<i32>,
    pub comment_count: Option<i32>,
    pub has_viewed: bool,
    pub has_liked: bool,
    pub score: f64,
}

#[derive(Deserialize)]
pub struct RecordInteractionRequest {
    pub interaction_type: String, // 'view', 'like', 'comment', 'skip'
    pub duration_seconds: Option<i32>,
}

// Get personalized feed using algorithm
pub async fn get_personalized_feed(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
    Query(params): Query<FeedQuery>,
) -> Result<Json<Vec<PersonalizedStory>>, StatusCode> {
    let user_uuid = uuid::Uuid::parse_str(&user_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let limit = params.limit.min(50);
    let offset = params.offset;

    // Calculate feed scores if not cached
    let _ = calculate_feed_scores(state.clone(), user_uuid).await;

    // Get stories ordered by score
    let stories = sqlx::query!(
        r#"
        SELECT 
            s.id,
            s.user_id,
            u.username,
            u.display_name,
            u.avatar_url,
            s.media_url,
            s.media_type,
            s.caption,
            s.created_at,
            s.view_count,
            s.like_count,
            s.comment_count,
            EXISTS(SELECT 1 FROM story_views WHERE story_id = s.id AND viewer_id = $1) as "has_viewed!",
            EXISTS(SELECT 1 FROM story_likes WHERE story_id = s.id AND user_id = $1) as "has_liked!",
            CAST(COALESCE(fs.score, 0.0) AS DOUBLE PRECISION) as "score!"
        FROM stories s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN feed_scores fs ON s.id = fs.story_id AND fs.user_id = $1
        WHERE s.created_at > NOW() - INTERVAL '7 days'
        ORDER BY fs.score DESC NULLS LAST, s.created_at DESC
        LIMIT $2 OFFSET $3
        "#,
        user_uuid,
        limit,
        offset
    )
    .fetch_all(&*state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let results = stories
        .into_iter()
        .map(|s| PersonalizedStory {
            id: s.id.to_string(),
            user_id: s.user_id.to_string(),
            username: s.username,
            display_name: s.display_name,
            avatar_url: s.avatar_url,
            media_url: s.media_url,
            media_type: s.media_type,
            caption: s.caption,
            created_at: s.created_at.and_utc().to_rfc3339(),
            view_count: s.view_count,
            like_count: s.like_count,
            comment_count: s.comment_count,
            has_viewed: s.has_viewed,
            has_liked: s.has_liked,
            score: s.score as f64,
        })
        .collect();

    Ok(Json(results))
}

// Record user interaction for algorithm learning
pub async fn record_interaction(
    State(state): State<Arc<AppState>>,
    Path((user_id, story_id)): Path<(String, String)>,
    Json(payload): Json<RecordInteractionRequest>,
) -> Result<StatusCode, StatusCode> {
    let user_uuid = uuid::Uuid::parse_str(&user_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let story_uuid = uuid::Uuid::parse_str(&story_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    sqlx::query!(
        r#"
        INSERT INTO user_interactions (user_id, story_id, interaction_type, duration_seconds)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, story_id, interaction_type, created_at) DO NOTHING
        "#,
        user_uuid,
        story_uuid,
        payload.interaction_type,
        payload.duration_seconds
    )
    .execute(&*state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Invalidate feed scores for this user (will be recalculated)
    let _ = sqlx::query!(
        "DELETE FROM feed_scores WHERE user_id = $1",
        user_uuid
    )
    .execute(&*state.pool)
    .await;

    Ok(StatusCode::OK)
}

// Calculate feed scores for a user (internal function)
async fn calculate_feed_scores(
    state: Arc<AppState>,
    user_id: uuid::Uuid,
) -> Result<(), sqlx::Error> {
    // Check if scores need recalculation (older than 1 hour)
    let needs_update = sqlx::query!(
        "SELECT COUNT(*) as count FROM feed_scores WHERE user_id = $1 AND calculated_at > NOW() - INTERVAL '1 hour'",
        user_id
    )
    .fetch_one(&*state.pool)
    .await?;

    if needs_update.count.unwrap_or(0) > 0 {
        return Ok(()); // Scores are fresh
    }

    // Get user's following list
    let following = sqlx::query!(
        "SELECT following_id FROM follows WHERE follower_id = $1",
        user_id
    )
    .fetch_all(&*state.pool)
    .await?;

    let _following_ids: Vec<uuid::Uuid> = following.iter().map(|f| f.following_id).collect();

    // Get recent stories
    let stories = sqlx::query!(
        r#"
        SELECT 
            s.id,
            s.user_id,
            s.created_at,
            s.view_count,
            s.like_count,
            s.comment_count,
            EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = s.user_id) as "is_following!"
        FROM stories s
        WHERE s.created_at > NOW() - INTERVAL '7 days'
        "#,
        user_id
    )
    .fetch_all(&*state.pool)
    .await?;

    // Calculate scores for each story
    for story in stories {
        let mut score = 0.0;

        // Recency score (0-10 points, newer = higher)
        let age_seconds = (Utc::now().timestamp() - story.created_at.and_utc().timestamp()) as f64;
        let age_hours = age_seconds / 3600.0;
        let recency_score = (10.0_f64 - (age_hours / 16.8)).max(0.0); // Decay over 7 days
        score += recency_score;

        // Following relationship (20 points if following)
        if story.is_following {
            score += 20.0;
        }

        // Engagement score (likes, comments, views)
        let likes = story.like_count.unwrap_or(0) as f64;
        let comments = story.comment_count.unwrap_or(0) as f64;
        let views = story.view_count.unwrap_or(1) as f64;

        // Engagement rate (likes + comments*2) / views
        let engagement_rate = ((likes + comments * 2.0) / views.max(1.0)) * 100.0;
        score += engagement_rate.min(30.0); // Cap at 30 points

        // Raw engagement (logarithmic scale)
        score += (likes * 0.5).min(10.0); // Up to 10 points for likes
        score += (comments * 1.0).min(10.0); // Up to 10 points for comments

        // User's past interactions with this creator
        let past_interactions = sqlx::query!(
            r#"
            SELECT interaction_type, COUNT(*) as count
            FROM user_interactions
            WHERE user_id = $1 AND story_id IN (
                SELECT id FROM stories WHERE user_id = $2
            )
            GROUP BY interaction_type
            "#,
            user_id,
            story.user_id
        )
        .fetch_all(&*state.pool)
        .await?;

        for interaction in past_interactions {
            match interaction.interaction_type.as_str() {
                "like" => score += interaction.count.unwrap_or(0) as f64 * 2.0,
                "comment" => score += interaction.count.unwrap_or(0) as f64 * 3.0,
                "view" => score += interaction.count.unwrap_or(0) as f64 * 0.5,
                "skip" => score -= interaction.count.unwrap_or(0) as f64 * 1.0,
                _ => {}
            }
        }

        // Insert or update score
        sqlx::query!(
            r#"
            INSERT INTO feed_scores (user_id, story_id, score, calculated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (user_id, story_id) 
            DO UPDATE SET score = $3, calculated_at = NOW()
            "#,
            user_id,
            story.id,
            score as f32
        )
        .execute(&*state.pool)
        .await?;
    }

    Ok(())
}

// Background job to recalculate all feed scores (call via cron)
pub async fn recalculate_all_feeds(
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode, StatusCode> {
    let users = sqlx::query!("SELECT id FROM users")
        .fetch_all(&*state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    for user in users {
        let _ = calculate_feed_scores(state.clone(), user.id).await;
    }

    Ok(StatusCode::OK)
}
