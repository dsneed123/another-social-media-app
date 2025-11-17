use sqlx::PgPool;
use std::sync::Arc;
use tokio::time::{interval, Duration};
use crate::media::MediaService;
use uuid::Uuid;

pub struct ExpirationService {
    pool: Arc<PgPool>,
    media_service: Arc<MediaService>,
}

impl ExpirationService {
    pub fn new(pool: Arc<PgPool>, media_service: Arc<MediaService>) -> Self {
        Self {
            pool,
            media_service,
        }
    }

    /// Start background task to clean up expired messages
    pub async fn start(self: Arc<Self>) {
        let mut ticker = interval(Duration::from_secs(60)); // Check every minute

        loop {
            ticker.tick().await;
            if let Err(e) = self.cleanup_expired_messages().await {
                eprintln!("Error cleaning up expired messages: {}", e);
            }
            if let Err(e) = self.cleanup_expired_media().await {
                eprintln!("Error cleaning up expired media: {}", e);
            }
        }
    }

    /// Delete expired messages (Snapchat-style expiration)
    async fn cleanup_expired_messages(&self) -> Result<(), sqlx::Error> {
        // Find expired messages
        let expired_messages = sqlx::query!(
            r#"
            SELECT id, media_url
            FROM messages
            WHERE expires_at IS NOT NULL
              AND expires_at < NOW()
              AND deleted_at IS NULL
            "#
        )
        .fetch_all(self.pool.as_ref())
        .await?;

        println!("Found {} expired messages to delete", expired_messages.len());

        for msg in expired_messages {
            // Soft delete the message
            sqlx::query!(
                "UPDATE messages SET deleted_at = NOW() WHERE id = $1",
                msg.id
            )
            .execute(self.pool.as_ref())
            .await?;

            // Delete associated media from S3 if exists
            if let Some(ref media_url) = msg.media_url {
                if let Some(s3_key) = extract_s3_key(media_url) {
                    let _ = self.media_service.delete_media(&s3_key).await;
                }
            }

            println!("Deleted expired message: {}", msg.id);
        }

        Ok(())
    }

    /// Delete expired media files from S3
    async fn cleanup_expired_media(&self) -> Result<(), sqlx::Error> {
        let expired_media = sqlx::query!(
            r#"
            SELECT id, s3_key, thumbnail_s3_key
            FROM media
            WHERE expires_at IS NOT NULL
              AND expires_at < NOW()
            "#
        )
        .fetch_all(self.pool.as_ref())
        .await?;

        println!("Found {} expired media files to delete", expired_media.len());

        for media in expired_media {
            // Delete from S3
            let _ = self.media_service.delete_media(&media.s3_key).await;

            if let Some(ref thumb_key) = media.thumbnail_s3_key {
                let _ = self.media_service.delete_media(thumb_key).await;
            }

            // Delete from database
            sqlx::query!("DELETE FROM media WHERE id = $1", media.id)
                .execute(self.pool.as_ref())
                .await?;

            println!("Deleted expired media: {}", media.id);
        }

        Ok(())
    }

    /// Delete view-once messages that have been viewed
    pub async fn cleanup_viewed_view_once_messages(&self) -> Result<(), sqlx::Error> {
        let viewed_messages = sqlx::query!(
            r#"
            SELECT DISTINCT m.id, m.media_url
            FROM messages m
            JOIN message_views mv ON m.id = mv.message_id
            WHERE m.view_once = TRUE
              AND m.deleted_at IS NULL
            "#
        )
        .fetch_all(self.pool.as_ref())
        .await?;

        for msg in viewed_messages {
            // Soft delete
            sqlx::query!(
                "UPDATE messages SET deleted_at = NOW() WHERE id = $1",
                msg.id
            )
            .execute(self.pool.as_ref())
            .await?;

            // Delete media from S3
            if let Some(ref media_url) = msg.media_url {
                if let Some(s3_key) = extract_s3_key(media_url) {
                    let _ = self.media_service.delete_media(&s3_key).await;
                }
            }

            println!("Deleted view-once message after viewing: {}", msg.id);
        }

        Ok(())
    }
}

/// Extract S3 key from full URL
fn extract_s3_key(url: &str) -> Option<String> {
    url.split(".s3.amazonaws.com/")
        .nth(1)
        .map(|s| s.to_string())
}
