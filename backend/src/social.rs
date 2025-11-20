use axum::{
    extract::{State, Path},
    Json,
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;
use chrono::NaiveDateTime;

use crate::AppState;

// ============= Follow System =============

#[derive(Debug, Serialize)]
pub struct FollowResponse {
    pub success: bool,
    pub message: String,
    pub is_following: bool,
}

#[derive(Debug, Serialize)]
pub struct FollowStats {
    pub follower_count: i32,
    pub following_count: i32,
    pub is_following: bool,
}

// Follow a user
pub async fn follow_user(
    State(state): State<Arc<AppState>>,
    Path((follower_id, following_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<FollowResponse>, StatusCode> {
    if follower_id == following_id {
        return Ok(Json(FollowResponse {
            success: false,
            message: "Cannot follow yourself".to_string(),
            is_following: false,
        }));
    }

    // Insert follow relationship
    let result = sqlx::query!(
        r#"
        INSERT INTO follows (follower_id, following_id)
        VALUES ($1, $2)
        ON CONFLICT (follower_id, following_id) DO NOTHING
        "#,
        follower_id,
        following_id
    )
    .execute(state.pool.as_ref())
    .await;

    match result {
        Ok(_) => Ok(Json(FollowResponse {
            success: true,
            message: "Successfully followed user".to_string(),
            is_following: true,
        })),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

// Unfollow a user
pub async fn unfollow_user(
    State(state): State<Arc<AppState>>,
    Path((follower_id, following_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<FollowResponse>, StatusCode> {
    sqlx::query!(
        r#"
        DELETE FROM follows
        WHERE follower_id = $1 AND following_id = $2
        "#,
        follower_id,
        following_id
    )
    .execute(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(FollowResponse {
        success: true,
        message: "Successfully unfollowed user".to_string(),
        is_following: false,
    }))
}

// Get follow stats for a user
pub async fn get_follow_stats(
    State(state): State<Arc<AppState>>,
    Path((user_id, viewer_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<FollowStats>, StatusCode> {
    let user = sqlx::query!(
        r#"
        SELECT follower_count, following_count
        FROM users
        WHERE id = $1
        "#,
        user_id
    )
    .fetch_optional(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    // Check if viewer is following this user
    let is_following = sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM follows
            WHERE follower_id = $1 AND following_id = $2
        ) as "exists!"
        "#,
        viewer_id,
        user_id
    )
    .fetch_one(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .exists;

    Ok(Json(FollowStats {
        follower_count: user.follower_count.unwrap_or(0),
        following_count: user.following_count.unwrap_or(0),
        is_following,
    }))
}

// Get list of followers
#[derive(Debug, Serialize)]
pub struct UserListItem {
    pub id: Uuid,
    pub username: String,
    pub follower_count: Option<i32>,
    pub is_following: bool,
}

pub async fn get_followers(
    State(state): State<Arc<AppState>>,
    Path((user_id, viewer_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Vec<UserListItem>>, StatusCode> {
    let followers = sqlx::query!(
        r#"
        SELECT 
            u.id,
            u.username,
            u.follower_count,
            EXISTS(
                SELECT 1 FROM follows f2
                WHERE f2.follower_id = $2 AND f2.following_id = u.id
            ) as "is_following!"
        FROM follows f
        JOIN users u ON f.follower_id = u.id
        WHERE f.following_id = $1
        ORDER BY f.created_at DESC
        "#,
        user_id,
        viewer_id
    )
    .fetch_all(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result = followers.into_iter().map(|f| UserListItem {
        id: f.id,
        username: f.username,
        follower_count: f.follower_count,
        is_following: f.is_following,
    }).collect();

    Ok(Json(result))
}

// Get list of following
pub async fn get_following(
    State(state): State<Arc<AppState>>,
    Path((user_id, viewer_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Vec<UserListItem>>, StatusCode> {
    let following = sqlx::query!(
        r#"
        SELECT 
            u.id,
            u.username,
            u.follower_count,
            EXISTS(
                SELECT 1 FROM follows f2
                WHERE f2.follower_id = $2 AND f2.following_id = u.id
            ) as "is_following!"
        FROM follows f
        JOIN users u ON f.following_id = u.id
        WHERE f.follower_id = $1
        ORDER BY f.created_at DESC
        "#,
        user_id,
        viewer_id
    )
    .fetch_all(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result = following.into_iter().map(|f| UserListItem {
        id: f.id,
        username: f.username,
        follower_count: f.follower_count,
        is_following: f.is_following,
    }).collect();

    Ok(Json(result))
}

// ============= Story Likes =============

#[derive(Debug, Serialize)]
pub struct LikeResponse {
    pub success: bool,
    pub is_liked: bool,
    pub like_count: i32,
}

// Like a story
pub async fn like_story(
    State(state): State<Arc<AppState>>,
    Path((story_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<LikeResponse>, StatusCode> {
    // Insert like
    sqlx::query!(
        r#"
        INSERT INTO story_likes (story_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (story_id, user_id) DO NOTHING
        "#,
        story_id,
        user_id
    )
    .execute(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Get updated like count
    let story = sqlx::query!(
        r#"
        SELECT like_count FROM stories WHERE id = $1
        "#,
        story_id
    )
    .fetch_one(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(LikeResponse {
        success: true,
        is_liked: true,
        like_count: story.like_count.unwrap_or(0),
    }))
}

// Unlike a story
pub async fn unlike_story(
    State(state): State<Arc<AppState>>,
    Path((story_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<LikeResponse>, StatusCode> {
    // Delete like
    sqlx::query!(
        r#"
        DELETE FROM story_likes
        WHERE story_id = $1 AND user_id = $2
        "#,
        story_id,
        user_id
    )
    .execute(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Get updated like count
    let story = sqlx::query!(
        r#"
        SELECT like_count FROM stories WHERE id = $1
        "#,
        story_id
    )
    .fetch_one(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(LikeResponse {
        success: true,
        is_liked: false,
        like_count: story.like_count.unwrap_or(0),
    }))
}

// Get users who liked a story
#[derive(Debug, Serialize)]
pub struct LikeUserItem {
    pub id: Uuid,
    pub username: String,
    pub created_at: NaiveDateTime,
}

pub async fn get_story_likes(
    State(state): State<Arc<AppState>>,
    Path(story_id): Path<Uuid>,
) -> Result<Json<Vec<LikeUserItem>>, StatusCode> {
    let likes = sqlx::query!(
        r#"
        SELECT 
            u.id,
            u.username,
            sl.created_at
        FROM story_likes sl
        JOIN users u ON sl.user_id = u.id
        WHERE sl.story_id = $1
        ORDER BY sl.created_at DESC
        "#,
        story_id
    )
    .fetch_all(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result = likes.into_iter().map(|l| LikeUserItem {
        id: l.id,
        username: l.username,
        created_at: l.created_at,
    }).collect();

    Ok(Json(result))
}

// ============= Story Comments =============

#[derive(Debug, Deserialize)]
pub struct CreateCommentRequest {
    pub comment_text: String,
}

#[derive(Debug, Serialize)]
pub struct Comment {
    pub id: Uuid,
    pub story_id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub comment_text: String,
    pub parent_comment_id: Option<Uuid>,
    pub reply_count: Option<i32>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Serialize)]
pub struct CommentResponse {
    pub success: bool,
    pub comment: Comment,
}

// Add a comment to a story
pub async fn add_comment(
    State(state): State<Arc<AppState>>,
    Path((story_id, user_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<CreateCommentRequest>,
) -> Result<Json<CommentResponse>, StatusCode> {
    if req.comment_text.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let comment_id = Uuid::new_v4();

    sqlx::query!(
        r#"
        INSERT INTO story_comments (id, story_id, user_id, comment_text)
        VALUES ($1, $2, $3, $4)
        "#,
        comment_id,
        story_id,
        user_id,
        req.comment_text.trim()
    )
    .execute(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Fetch the created comment with username
    let comment = sqlx::query!(
        r#"
        SELECT 
            sc.id,
            sc.story_id,
            sc.user_id,
            u.username,
            sc.comment_text,
            sc.created_at
        FROM story_comments sc
        JOIN users u ON sc.user_id = u.id
        WHERE sc.id = $1
        "#,
        comment_id
    )
    .fetch_one(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(CommentResponse {
        success: true,
        comment: Comment {
            id: comment.id,
            story_id: comment.story_id,
            user_id: comment.user_id,
            username: comment.username,
            comment_text: comment.comment_text,
            parent_comment_id: None,
            reply_count: Some(0),
            created_at: comment.created_at,
        },
    }))
}

// Get comments for a story
pub async fn get_story_comments(
    State(state): State<Arc<AppState>>,
    Path(story_id): Path<Uuid>,
) -> Result<Json<Vec<Comment>>, StatusCode> {
    let comments = sqlx::query!(
        r#"
        SELECT
            sc.id,
            sc.story_id,
            sc.user_id,
            u.username,
            sc.comment_text,
            sc.parent_comment_id,
            sc.reply_count,
            sc.created_at
        FROM story_comments sc
        JOIN users u ON sc.user_id = u.id
        WHERE sc.story_id = $1 AND sc.parent_comment_id IS NULL
        ORDER BY sc.created_at ASC
        "#,
        story_id
    )
    .fetch_all(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result = comments.into_iter().map(|c| Comment {
        id: c.id,
        story_id: c.story_id,
        user_id: c.user_id,
        username: c.username,
        comment_text: c.comment_text,
        parent_comment_id: c.parent_comment_id,
        reply_count: c.reply_count,
        created_at: c.created_at,
    }).collect();

    Ok(Json(result))
}

// Delete a comment
pub async fn delete_comment(
    State(state): State<Arc<AppState>>,
    Path((comment_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query!(
        r#"
        DELETE FROM story_comments
        WHERE id = $1 AND user_id = $2
        "#,
        comment_id,
        user_id
    )
    .execute(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

// ============= Profile System =============

#[derive(Debug, Serialize)]
pub struct UserProfile {
    pub id: Uuid,
    pub username: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
    pub about: Option<String>,
    pub profile_link: Option<String>,
    pub follower_count: Option<i32>,
    pub following_count: Option<i32>,
    pub story_count: Option<i32>,
    pub is_following: Option<bool>,
    pub email: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub display_name: Option<String>,
    pub bio: Option<String>,
    pub about: Option<String>,
    pub profile_link: Option<String>,
    pub avatar_url: Option<String>,
}

// Get user profile
pub async fn get_user_profile(
    State(state): State<Arc<AppState>>,
    Path((user_id, viewer_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<UserProfile>, StatusCode> {
    let profile = sqlx::query_as!(
        UserProfile,
        r#"
        SELECT 
            u.id,
            u.username,
            u.display_name,
            u.avatar_url,
            u.bio,
            u.about,
            u.profile_link,
            u.email,
            u.follower_count,
            u.following_count,
            u.story_count,
            EXISTS(
                SELECT 1 FROM follows 
                WHERE follower_id = $2 AND following_id = $1
            ) as "is_following?"
        FROM users u
        WHERE u.id = $1
        "#,
        user_id,
        viewer_id
    )
    .fetch_one(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(profile))
}

// Get user's stories (for profile grid)
#[derive(Debug, Serialize)]
pub struct ProfileStory {
    pub id: Uuid,
    pub media_url: String,
    pub media_type: String,
    pub caption: Option<String>,
    pub view_count: Option<i32>,
    pub like_count: Option<i32>,
    pub comment_count: Option<i32>,
    pub created_at: NaiveDateTime,
}

pub async fn get_user_stories(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Vec<ProfileStory>>, StatusCode> {
    let stories = sqlx::query_as!(
        ProfileStory,
        r#"
        SELECT 
            id,
            media_url,
            media_type,
            caption,
            view_count,
            like_count,
            comment_count,
            created_at
            FROM stories
            WHERE user_id = $1 AND expires_at > NOW()
            ORDER BY created_at DESC
        "#,
        user_id
    )
    .fetch_all(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(stories))
}

// Update user profile
pub async fn update_user_profile(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<Uuid>,
    Json(payload): Json<UpdateProfileRequest>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query!(
        r#"
        UPDATE users
        SET 
            display_name = COALESCE($2, display_name),
            bio = COALESCE($3, bio),
            about = COALESCE($4, about),
            profile_link = COALESCE($5, profile_link),
            avatar_url = COALESCE($6, avatar_url)
        WHERE id = $1
        "#,
        user_id,
        payload.display_name,
        payload.bio,
        payload.about,
        payload.profile_link,
        payload.avatar_url
    )
    .execute(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

// ============= Comment Replies =============

#[derive(Debug, Serialize)]
pub struct CommentWithReplies {
    pub id: Uuid,
    pub story_id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub comment_text: String,
    pub parent_comment_id: Option<Uuid>,
    pub reply_count: Option<i32>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct ReplyRequest {
    pub comment_text: String,
    pub parent_comment_id: Uuid,
}

// Add reply to comment
pub async fn add_reply(
    State(state): State<Arc<AppState>>,
    Path((story_id, user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<ReplyRequest>,
) -> Result<Json<CommentWithReplies>, StatusCode> {
    let reply = sqlx::query_as!(
        CommentWithReplies,
        r#"
        INSERT INTO story_comments (story_id, user_id, comment_text, parent_comment_id)
        VALUES ($1, $2, $3, $4)
        RETURNING 
            id,
            story_id,
            user_id,
            (SELECT username FROM users WHERE id = $2) as "username!",
            comment_text,
            parent_comment_id,
            reply_count,
            created_at
        "#,
        story_id,
        user_id,
        payload.comment_text,
        payload.parent_comment_id
    )
    .fetch_one(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(reply))
}

// Get replies to a comment
pub async fn get_comment_replies(
    State(state): State<Arc<AppState>>,
    Path(comment_id): Path<Uuid>,
) -> Result<Json<Vec<CommentWithReplies>>, StatusCode> {
    let replies = sqlx::query_as!(
        CommentWithReplies,
        r#"
        SELECT 
            c.id,
            c.story_id,
            c.user_id,
            u.username,
            c.comment_text,
            c.parent_comment_id,
            c.reply_count,
            c.created_at
        FROM story_comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.parent_comment_id = $1
        ORDER BY c.created_at ASC
        "#,
        comment_id
    )
    .fetch_all(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(replies))
}
