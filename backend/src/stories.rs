use axum::{
    extract::{State, Path, Multipart},
    Json,
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;
use chrono::{Utc, NaiveDateTime};
use aws_sdk_s3::primitives::ByteStream;

use crate::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct Story {
    pub id: Uuid,
    pub user_id: Uuid,
    pub media_url: String,
    pub media_type: String,
    pub thumbnail_url: Option<String>,
    pub caption: Option<String>,
    pub view_count: Option<i32>,
    pub like_count: Option<i32>,
    pub comment_count: Option<i32>,
    pub created_at: NaiveDateTime,
    pub expires_at: NaiveDateTime,
    pub username: Option<String>,
    pub is_viewed: Option<bool>,
    pub is_liked: Option<bool>,

    // Ad-specific fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_ad: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ad_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ad_link: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateStoryResponse {
    pub story_id: Uuid,
    pub upload_url: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct StoriesResponse {
    pub stories: Vec<Story>,
}

// Create a new story with multipart upload
pub async fn create_story_multipart(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<CreateStoryResponse>, StatusCode> {
    println!("📸 Received story creation request");
    
    let mut user_id: Option<Uuid> = None;
    let mut media_type: Option<String> = None;
    let mut caption: Option<String> = None;
    let mut file_data: Option<Vec<u8>> = None;
    let mut filename: Option<String> = None;

    // Parse multipart form data
    while let Some(field) = multipart.next_field().await.unwrap() {
        let name = field.name().unwrap_or("").to_string();

        match name.as_str() {
            "user_id" => {
                let value = field.text().await.unwrap();
                user_id = Uuid::parse_str(&value).ok();
            }
            "media_type" => {
                media_type = Some(field.text().await.unwrap());
            }
            "caption" => {
                caption = Some(field.text().await.unwrap());
            }
            "file" => {
                filename = field.file_name().map(|s| s.to_string());
                file_data = Some(field.bytes().await.unwrap().to_vec());
            }
            _ => {}
        }
    }

    let user_id = user_id.ok_or_else(|| {
        eprintln!("❌ Missing user_id in story creation");
        StatusCode::BAD_REQUEST
    })?;
    let media_type = media_type.unwrap_or_else(|| "image".to_string());
    let file_data = file_data.ok_or_else(|| {
        eprintln!("❌ Missing file data in story creation");
        StatusCode::BAD_REQUEST
    })?;
    // Always generate a unique filename to prevent overwriting
    let unique_filename = format!("story_{}.jpg", Uuid::new_v4());
    let filename = unique_filename;

    println!("📤 Uploading story for user {} ({})", user_id, filename);

    // Upload to S3
    let story_id = Uuid::new_v4();
    let s3_key = format!("stories/{}/{}", user_id, filename);
    
    let byte_stream = ByteStream::from(file_data.clone());
    state.media_service.s3_client
        .put_object()
        .bucket(&state.media_service.bucket_name)
        .key(&s3_key)
        .body(byte_stream)
        .send()
        .await
        .map_err(|e| {
            eprintln!("❌ S3 upload failed: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Construct public URL
    let media_url = if let Some(ref public_base) = state.media_service.public_url_base {
        format!("{}/{}", public_base, s3_key)
    } else {
        format!("https://{}.s3.amazonaws.com/{}", state.media_service.bucket_name, s3_key)
    };

    // Create story in database
    let expires_at = Utc::now().naive_utc() + chrono::Duration::hours(24);

    sqlx::query!(
        r#"
        INSERT INTO stories (id, user_id, media_url, media_type, caption, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
        story_id,
        user_id,
        media_url,
        media_type,
        caption,
        expires_at
    )
    .execute(state.pool.as_ref())
    .await
    .map_err(|e| {
        eprintln!("❌ Database insert failed: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    println!("✅ Story created successfully: {}", story_id);

    Ok(Json(CreateStoryResponse {
        story_id,
        upload_url: media_url.clone(),
        message: "Story created successfully".to_string(),
    }))
}

// Get stories for a specific user
pub async fn get_user_stories(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<StoriesResponse>, StatusCode> {
    let stories = sqlx::query!(
        r#"
        SELECT
            s.id,
            s.user_id,
            s.media_url,
            s.media_type,
            s.thumbnail_url,
            s.caption,
            s.view_count,
            s.like_count,
            s.comment_count,
            s.created_at,
            s.expires_at,
            u.username
        FROM stories s
        JOIN users u ON s.user_id = u.id
        WHERE s.user_id = $1
        AND s.expires_at > NOW()
        ORDER BY s.created_at DESC
        "#,
        user_id
    )
    .fetch_all(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .into_iter()
    .map(|row| Story {
        id: row.id,
        user_id: row.user_id,
        media_url: row.media_url,
        media_type: row.media_type,
        thumbnail_url: row.thumbnail_url,
        caption: row.caption,
        view_count: row.view_count,
        like_count: row.like_count,
        comment_count: row.comment_count,
        created_at: row.created_at,
        expires_at: row.expires_at,
        username: Some(row.username),
        is_viewed: None,
        is_liked: None,
        is_ad: None,
        ad_title: None,
        ad_link: None,
    })
    .collect();

    Ok(Json(StoriesResponse { stories }))
}

// Get feed stories (from all users or friends)
pub async fn get_feed_stories(
    State(state): State<Arc<AppState>>,
    Path(viewer_id): Path<Uuid>,
) -> Result<Json<StoriesResponse>, StatusCode> {
    // Fetch regular stories (excluding already viewed ones)
    let mut stories = sqlx::query!(
        r#"
        SELECT
            s.id,
            s.user_id,
            s.media_url,
            s.media_type,
            s.thumbnail_url,
            s.caption,
            s.view_count,
            s.like_count,
            s.comment_count,
            s.created_at,
            s.expires_at,
            u.username,
            FALSE as is_viewed,
            EXISTS(SELECT 1 FROM story_likes sl WHERE sl.story_id = s.id AND sl.user_id = $1) as is_liked
        FROM stories s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN story_views sv ON s.id = sv.story_id AND sv.viewer_id = $1
        WHERE s.expires_at > NOW()
          AND sv.viewer_id IS NULL
        ORDER BY s.created_at DESC
        LIMIT 50
        "#,
        viewer_id
    )
    .fetch_all(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .into_iter()
    .map(|row| Story {
        id: row.id,
        user_id: row.user_id,
        media_url: row.media_url,
        media_type: row.media_type,
        thumbnail_url: row.thumbnail_url,
        caption: row.caption,
        view_count: row.view_count,
        like_count: row.like_count,
        comment_count: row.comment_count,
        created_at: row.created_at,
        expires_at: row.expires_at,
        username: Some(row.username),
        is_viewed: row.is_viewed,
        is_liked: row.is_liked,
        is_ad: None,
        ad_title: None,
        ad_link: None,
    })
    .collect::<Vec<Story>>();

    // Fetch active ads that this user hasn't seen yet
    let ads = sqlx::query!(
        r#"
        SELECT
            a.id,
            a.created_by,
            a.title,
            a.description,
            a.image_url,
            a.link_url,
            a.created_at
        FROM advertisements a
        LEFT JOIN ad_impressions ai ON a.id = ai.ad_id AND ai.user_id = $1
        WHERE a.status = 'active'
            AND a.current_impressions < a.target_impressions
            AND (a.expires_at IS NULL OR a.expires_at > NOW())
            AND ai.id IS NULL
        ORDER BY RANDOM()
        LIMIT 10
        "#,
        viewer_id
    )
    .fetch_all(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Inject ads into feed every 5 stories
    if !ads.is_empty() {
        let mut result = Vec::new();
        let mut ad_index = 0;

        for (i, story) in stories.into_iter().enumerate() {
            result.push(story);

            // Insert an ad after every 2 stories (was 5, reduced for testing)
            if (i + 1) % 2 == 0 && ad_index < ads.len() {
                let ad = &ads[ad_index];
                let ad_story = Story {
                    id: ad.id,
                    user_id: ad.created_by.unwrap_or_default(),
                    media_url: ad.image_url.clone().unwrap_or_default(),
                    media_type: "image".to_string(),
                    thumbnail_url: ad.image_url.clone(),
                    caption: ad.description.clone(),
                    view_count: None,
                    like_count: None,
                    comment_count: None,
                    created_at: ad.created_at.unwrap_or_else(|| Utc::now().naive_utc()),
                    expires_at: Utc::now().naive_utc() + chrono::Duration::days(1),
                    username: Some("Sponsored".to_string()),
                    is_viewed: None,
                    is_liked: None,
                    is_ad: Some(true),
                    ad_title: Some(ad.title.clone()),
                    ad_link: ad.link_url.clone(),
                };
                result.push(ad_story);
                ad_index += 1;
            }
        }

        stories = result;
    }

    Ok(Json(StoriesResponse { stories }))
}

// Get stories grouped by user for the stories page
pub async fn get_stories_by_user(
    State(state): State<Arc<AppState>>,
    Path(viewer_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    #[derive(Debug, Serialize)]
    struct UserStories {
        user_id: Uuid,
        username: String,
        latest_story_url: String,
        story_count: i64,
        has_unviewed: bool,
    }

    let user_stories = sqlx::query_as!(
        UserStories,
        r#"
        SELECT 
            s.user_id,
            u.username,
            (SELECT media_url FROM stories WHERE user_id = s.user_id AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1) as "latest_story_url!",
            COUNT(DISTINCT s.id) as "story_count!",
            COALESCE(BOOL_OR(sv.viewer_id IS NULL), false) as "has_unviewed!"
        FROM stories s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN story_views sv ON s.id = sv.story_id AND sv.viewer_id = $1
        WHERE s.expires_at > NOW()
        GROUP BY s.user_id, u.username
        ORDER BY COALESCE(BOOL_OR(sv.viewer_id IS NULL), false) DESC, MAX(s.created_at) DESC
        "#,
        viewer_id
    )
    .fetch_all(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({ "users": user_stories })))
}

// Mark story as viewed
pub async fn mark_story_viewed(
    State(state): State<Arc<AppState>>,
    Path((story_id, viewer_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, StatusCode> {
    // Insert view record
    sqlx::query!(
        r#"
        INSERT INTO story_views (story_id, viewer_id)
        VALUES ($1, $2)
        ON CONFLICT (story_id, viewer_id) DO NOTHING
        "#,
        story_id,
        viewer_id
    )
    .execute(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Increment view count
    sqlx::query!(
        r#"
        UPDATE stories
        SET view_count = view_count + 1
        WHERE id = $1
        "#,
        story_id
    )
    .execute(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

// Delete a story
pub async fn delete_story(
    State(state): State<Arc<AppState>>,
    Path((story_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, StatusCode> {
    // Get story to delete media
    let story = sqlx::query!(
        r#"
        SELECT media_url FROM stories
        WHERE id = $1 AND user_id = $2
        "#,
        story_id,
        user_id
    )
    .fetch_optional(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    // Delete from S3 - extract key from URL
    if let Some(key) = story.media_url.split('/').skip(3).collect::<Vec<_>>().join("/").into() {
        if let Err(e) = state.media_service.s3_client
            .delete_object()
            .bucket(&state.media_service.bucket_name)
            .key(key)
            .send()
            .await {
            eprintln!("Failed to delete media from S3: {}", e);
        }
    }

    // Delete from database
    sqlx::query!(
        r#"
        DELETE FROM stories
        WHERE id = $1 AND user_id = $2
        "#,
        story_id,
        user_id
    )
    .execute(state.pool.as_ref())
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}
