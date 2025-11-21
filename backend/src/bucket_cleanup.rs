use aws_sdk_s3::Client as S3Client;
use chrono::Utc;
use sqlx::PgPool;
use std::collections::HashSet;

/// Clean up unused files from S3 bucket
/// Removes:
/// - Files older than 30 days that aren't in the database
/// - Expired story files (24 hours after expiration)
/// - Orphaned temporary files
pub async fn cleanup_unused_files(
    s3_client: &S3Client,
    bucket_name: &str,
    pool: &PgPool,
) -> Result<CleanupStats, String> {
    println!("🧹 Starting bucket cleanup...");

    let mut stats = CleanupStats {
        files_scanned: 0,
        files_deleted: 0,
        bytes_freed: 0,
    };

    // Get all files in bucket
    let objects = list_all_objects(s3_client, bucket_name).await?;
    stats.files_scanned = objects.len();

    println!("📊 Found {} files in bucket", objects.len());

    // Get all active media URLs from database
    let active_urls = get_active_media_urls(pool).await?;
    let active_keys: HashSet<String> = active_urls.iter()
        .filter_map(|url| extract_s3_key(url, bucket_name))
        .collect();

    println!("✅ Found {} active files in database", active_keys.len());

    // Check expired stories
    let expired_story_keys = get_expired_story_keys(pool).await?;
    println!("⏰ Found {} expired story files", expired_story_keys.len());

    // Delete orphaned and expired files
    for (key, size, last_modified) in objects {
        let should_delete = if expired_story_keys.contains(&key) {
            // Delete expired stories (24 hours after expiration)
            println!("  🗑️ Deleting expired story: {}", key);
            true
        } else if !active_keys.contains(&key) {
            // Delete if file is orphaned and older than 30 days
            let age_days = (Utc::now() - last_modified).num_days();
            if age_days > 30 {
                println!("  🗑️ Deleting orphaned file ({}d old): {}", age_days, key);
                true
            } else {
                false
            }
        } else {
            false
        };

        if should_delete {
            match delete_object(s3_client, bucket_name, &key).await {
                Ok(_) => {
                    stats.files_deleted += 1;
                    stats.bytes_freed += size;
                    println!("    ✅ Deleted: {} ({} bytes)", key, size);
                }
                Err(e) => {
                    eprintln!("    ❌ Failed to delete {}: {}", key, e);
                }
            }
        }
    }

    // Clean up orphaned story records from database
    let deleted_records = cleanup_orphaned_story_records(pool, s3_client, bucket_name).await?;
    println!("🗄️ Cleaned up {} orphaned story records", deleted_records);

    println!("✅ Cleanup complete:");
    println!("  - Scanned: {} files", stats.files_scanned);
    println!("  - Deleted: {} files", stats.files_deleted);
    println!("  - Freed: {} MB", stats.bytes_freed / (1024 * 1024));

    Ok(stats)
}

#[derive(Debug)]
pub struct CleanupStats {
    pub files_scanned: usize,
    pub files_deleted: usize,
    pub bytes_freed: i64,
}

/// List all objects in bucket with metadata
async fn list_all_objects(
    s3_client: &S3Client,
    bucket_name: &str,
) -> Result<Vec<(String, i64, chrono::DateTime<Utc>)>, String> {
    let mut objects = Vec::new();
    let mut continuation_token: Option<String> = None;

    loop {
        let mut request = s3_client.list_objects_v2()
            .bucket(bucket_name);

        if let Some(token) = continuation_token {
            request = request.continuation_token(token);
        }

        let response = request.send()
            .await
            .map_err(|e| format!("Failed to list objects: {}", e))?;

        if let Some(contents) = response.contents {
            for object in contents {
                if let (Some(key), Some(size), Some(last_modified)) = (
                    object.key,
                    object.size,
                    object.last_modified,
                ) {
                    let dt = chrono::DateTime::from_timestamp(
                        last_modified.secs(),
                        last_modified.subsec_nanos(),
                    ).unwrap_or_else(|| Utc::now());

                    objects.push((key, size, dt));
                }
            }
        }

        if !response.is_truncated.unwrap_or(false) {
            break;
        }

        continuation_token = response.next_continuation_token;
    }

    Ok(objects)
}

/// Get all active media URLs from database
async fn get_active_media_urls(pool: &PgPool) -> Result<Vec<String>, String> {
    let mut urls = Vec::new();

    // Get story media URLs
    let stories = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT media_url, thumbnail_url FROM stories WHERE expires_at > NOW()"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch active stories: {}", e))?;

    for (media_url, thumbnail_url) in stories {
        urls.push(media_url);
        if let Some(thumb) = thumbnail_url {
            urls.push(thumb);
        }
    }

    // Get profile pictures
    let users = sqlx::query_as::<_, (Option<String>,)>(
        "SELECT profile_pic FROM users WHERE profile_pic IS NOT NULL"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch user profiles: {}", e))?;

    for (profile_pic,) in users {
        if let Some(pic) = profile_pic {
            urls.push(pic);
        }
    }

    // Get post media URLs
    let posts = sqlx::query_as::<_, (Option<Vec<String>>,)>(
        "SELECT media_urls FROM posts WHERE media_urls IS NOT NULL"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch posts: {}", e))?;

    for (media_urls,) in posts {
        if let Some(media_urls) = media_urls {
            for url in media_urls {
                urls.push(url);
            }
        }
    }

    // Get message attachments
    let messages = sqlx::query_as::<_, (Option<String>,)>(
        "SELECT attachment_url FROM messages WHERE attachment_url IS NOT NULL AND created_at > NOW() - INTERVAL '90 days'"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch messages: {}", e))?;

    for (attachment_url,) in messages {
        if let Some(url) = attachment_url {
            urls.push(url);
        }
    }

    Ok(urls)
}

/// Get S3 keys for expired stories
async fn get_expired_story_keys(pool: &PgPool) -> Result<HashSet<String>, String> {
    let expired_stories = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT media_url, thumbnail_url FROM stories WHERE expires_at < NOW() - INTERVAL '24 hours'"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch expired stories: {}", e))?;

    let mut keys = HashSet::new();

    for (media_url, thumbnail_url) in expired_stories {
        if let Some(key) = extract_s3_key_from_any_url(&media_url) {
            keys.insert(key);
        }
        if let Some(thumb) = thumbnail_url {
            if let Some(key) = extract_s3_key_from_any_url(&thumb) {
                keys.insert(key);
            }
        }
    }

    Ok(keys)
}

/// Delete an object from S3
async fn delete_object(
    s3_client: &S3Client,
    bucket_name: &str,
    key: &str,
) -> Result<(), String> {
    s3_client
        .delete_object()
        .bucket(bucket_name)
        .key(key)
        .send()
        .await
        .map_err(|e| format!("Failed to delete object: {}", e))?;

    Ok(())
}

/// Extract S3 key from URL
fn extract_s3_key(url: &str, bucket_name: &str) -> Option<String> {
    // Handle both S3 and CloudFlare R2 URLs
    if let Some(key) = url.strip_prefix(&format!("https://{}.s3.amazonaws.com/", bucket_name)) {
        Some(key.to_string())
    } else if let Some(key) = url.split('/').skip(3).collect::<Vec<_>>().join("/").into() {
        Some(key)
    } else {
        None
    }
}

/// Extract S3 key from any URL format
fn extract_s3_key_from_any_url(url: &str) -> Option<String> {
    // Try to extract key from various URL formats
    if let Some(pos) = url.find(".amazonaws.com/") {
        Some(url[pos + 15..].to_string())
    } else if let Some(pos) = url.find(".r2.dev/") {
        Some(url[pos + 8..].to_string())
    } else {
        // Assume last parts of URL are the key
        url.split('/')
            .skip(3)
            .collect::<Vec<_>>()
            .join("/")
            .into()
    }
}

/// Clean up orphaned story records (where S3 file doesn't exist)
async fn cleanup_orphaned_story_records(
    pool: &PgPool,
    s3_client: &S3Client,
    bucket_name: &str,
) -> Result<i32, String> {
    use sqlx::Row;

    let expired_stories = sqlx::query(
        "SELECT id, media_url FROM stories WHERE expires_at < NOW() - INTERVAL '24 hours'"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch expired stories: {}", e))?;

    let mut deleted_count = 0;

    for story in expired_stories {
        let story_id: uuid::Uuid = story.get("id");
        let media_url: String = story.get("media_url");

        // Check if S3 object exists
        if let Some(key) = extract_s3_key_from_any_url(&media_url) {
            let exists = s3_client
                .head_object()
                .bucket(bucket_name)
                .key(&key)
                .send()
                .await
                .is_ok();

            if !exists {
                // Delete orphaned record
                sqlx::query("DELETE FROM stories WHERE id = $1")
                    .bind(story_id)
                    .execute(pool)
                    .await
                    .map_err(|e| format!("Failed to delete story record: {}", e))?;

                deleted_count += 1;
            }
        }
    }

    Ok(deleted_count)
}

/// Run cleanup on a schedule (called by a background task)
pub async fn run_scheduled_cleanup(
    s3_client: &S3Client,
    bucket_name: &str,
    pool: &PgPool,
) {
    loop {
        println!("🕐 Running scheduled bucket cleanup...");

        match cleanup_unused_files(s3_client, bucket_name, pool).await {
            Ok(stats) => {
                println!("✅ Cleanup successful: {:?}", stats);
            }
            Err(e) => {
                eprintln!("❌ Cleanup failed: {}", e);
            }
        }

        // Run every 6 hours
        tokio::time::sleep(tokio::time::Duration::from_secs(6 * 60 * 60)).await;
    }
}
