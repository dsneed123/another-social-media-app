use axum::{
    extract::{Json, State, Multipart},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::sync::Arc;
use aws_sdk_s3::Client as S3Client;
use aws_sdk_s3::primitives::ByteStream;
use base64::{Engine as _, engine::general_purpose};

#[derive(Serialize, Deserialize)]
pub struct UploadResponse {
    pub media_id: Uuid,
    pub url: String,
    pub thumbnail_url: Option<String>,
    pub file_type: String,
}

#[derive(Serialize, Deserialize)]
pub struct UploadImageRequest {
    pub image_data: String, // Base64 encoded image from webcam
    pub file_type: String,  // e.g., "image/jpeg"
    pub expires_in_seconds: Option<i64>,
}

pub struct MediaService {
    pub s3_client: S3Client,
    pub bucket_name: String,
    pub public_url_base: Option<String>,
}

impl MediaService {
    pub async fn new() -> Self {
        let config = aws_config::defaults(aws_config::BehaviorVersion::latest())
            .load()
            .await;

        // Check if using Cloudflare R2 (or other S3-compatible service)
        let s3_client = if let Ok(r2_endpoint) = std::env::var("R2_ENDPOINT") {
            println!("✓ Using Cloudflare R2 at {}", r2_endpoint);
            println!("  AWS_REGION: {}", std::env::var("AWS_REGION").unwrap_or_else(|_| "not set".to_string()));
            println!("  AWS_ACCESS_KEY_ID: {}", if std::env::var("AWS_ACCESS_KEY_ID").is_ok() { "set" } else { "NOT SET" });
            println!("  AWS_SECRET_ACCESS_KEY: {}", if std::env::var("AWS_SECRET_ACCESS_KEY").is_ok() { "set" } else { "NOT SET" });

            // Configure S3 client with custom endpoint for R2
            let s3_config = aws_sdk_s3::config::Builder::from(&config)
                .endpoint_url(r2_endpoint)
                .force_path_style(true) // R2 requires path-style URLs
                .build();

            S3Client::from_conf(s3_config)
        } else {
            // Standard AWS S3
            println!("✓ Using AWS S3");
            S3Client::new(&config)
        };

        let bucket_name = std::env::var("S3_BUCKET_NAME")
            .unwrap_or_else(|_| "relayhub-media".to_string());

        // Get public URL base (for R2 public buckets or custom domains)
        let public_url_base = std::env::var("R2_PUBLIC_URL").ok();

        println!("✓ S3/R2 bucket: {}", bucket_name);
        println!("✓ Public URL base: {}", public_url_base.as_ref().unwrap_or(&"not set".to_string()));

        Self {
            s3_client,
            bucket_name,
            public_url_base,
        }
    }

    pub async fn upload_base64_image(
        &self,
        user_id: Uuid,
        base64_data: &str,
        file_type: &str,
        _expires_in_seconds: Option<i64>,
    ) -> Result<UploadResponse, String> {
        // Decode base64 image
        let image_data = general_purpose::STANDARD.decode(base64_data)
            .map_err(|e| format!("Failed to decode base64: {}", e))?;

        // Generate unique S3 key
        let file_extension = match file_type {
            "image/jpeg" | "image/jpg" => "jpg",
            "image/png" => "png",
            "image/webp" => "webp",
            _ => "jpg",
        };

        let media_id = Uuid::new_v4();
        let s3_key = format!("messages/{}/{}.{}", user_id, media_id, file_extension);

        // Upload to S3
        let byte_stream = ByteStream::from(image_data.clone());

        // Upload to S3/R2
        let put_request = self.s3_client
            .put_object()
            .bucket(&self.bucket_name)
            .key(&s3_key)
            .body(byte_stream)
            .content_type(file_type);

        // Note: Expiration is handled by the database and background cleanup service
        // S3 object lifecycle policies can also be configured in the bucket settings
        put_request.send().await
            .map_err(|e| format!("Failed to upload to S3/R2: {}", e))?;

        // Generate public URL
        let url = if let Some(ref public_base) = self.public_url_base {
            // Use R2 public URL or custom domain
            format!("{}/{}", public_base.trim_end_matches('/'), s3_key)
        } else {
            // Standard S3 URL
            format!(
                "https://{}.s3.amazonaws.com/{}",
                self.bucket_name, s3_key
            )
        };

        // Generate thumbnail for large images
        let thumbnail_url = self.create_thumbnail(&image_data, user_id, media_id, file_type).await.ok();

        Ok(UploadResponse {
            media_id,
            url,
            thumbnail_url,
            file_type: file_type.to_string(),
        })
    }

    async fn create_thumbnail(
        &self,
        image_data: &[u8],
        user_id: Uuid,
        media_id: Uuid,
        _file_type: &str,
    ) -> Result<String, String> {
        // Load image
        let img = image::load_from_memory(image_data)
            .map_err(|e| format!("Failed to load image: {}", e))?;

        // Create thumbnail (max 300x300)
        let thumbnail = img.thumbnail(300, 300);

        // Encode to JPEG
        let mut buffer = Vec::new();
        thumbnail
            .write_to(
                &mut std::io::Cursor::new(&mut buffer),
                image::ImageOutputFormat::Jpeg(80),
            )
            .map_err(|e| format!("Failed to encode thumbnail: {}", e))?;

        // Upload thumbnail to S3
        let thumbnail_key = format!("messages/{}/{}_thumb.jpg", user_id, media_id);
        let byte_stream = ByteStream::from(buffer);

        self.s3_client
            .put_object()
            .bucket(&self.bucket_name)
            .key(&thumbnail_key)
            .body(byte_stream)
            .content_type("image/jpeg")
            .send()
            .await
            .map_err(|e| format!("Failed to upload thumbnail: {}", e))?;

        let thumbnail_url = if let Some(ref public_base) = self.public_url_base {
            // Use R2 public URL or custom domain
            format!("{}/{}", public_base.trim_end_matches('/'), thumbnail_key)
        } else {
            // Standard S3 URL
            format!(
                "https://{}.s3.amazonaws.com/{}",
                self.bucket_name, thumbnail_key
            )
        };

        Ok(thumbnail_url)
    }

    pub async fn delete_media(&self, s3_key: &str) -> Result<(), String> {
        self.s3_client
            .delete_object()
            .bucket(&self.bucket_name)
            .key(s3_key)
            .send()
            .await
            .map_err(|e| format!("Failed to delete from S3: {}", e))?;

        Ok(())
    }
}

// HTTP handler for uploading images (e.g., from webcam)
pub async fn upload_image(
    State(state): State<Arc<crate::AppState>>,
    Json(payload): Json<UploadImageRequest>,
) -> Result<Json<UploadResponse>, StatusCode> {
    // TODO: Extract user_id from JWT auth
    let user_id = Uuid::new_v4();

    let result = state.media_service
        .upload_base64_image(
            user_id,
            &payload.image_data,
            &payload.file_type,
            payload.expires_in_seconds,
        )
        .await
        .map_err(|e| {
            eprintln!("Upload error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(result))
}

// HTTP handler for multipart form uploads
pub async fn upload_multipart(
    State(state): State<Arc<crate::AppState>>,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>, StatusCode> {
    println!("📤 Received multipart upload request");
    let user_id = Uuid::new_v4(); // TODO: Get from auth

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        println!("📎 Processing field: {}", name);

        if name == "file" {
            let content_type = field.content_type().unwrap_or("image/jpeg").to_string();
            println!("📷 File content type: {}", content_type);

            let data = match field.bytes().await {
                Ok(bytes) => bytes,
                Err(e) => {
                    eprintln!("❌ Failed to read file data: {}", e);
                    return Err(StatusCode::BAD_REQUEST);
                }
            };

            println!("📦 File size: {} bytes", data.len());

            // Convert to base64 for processing
            let base64_data = general_purpose::STANDARD.encode(&data);

            let result = state.media_service
                .upload_base64_image(user_id, &base64_data, &content_type, None)
                .await
                .map_err(|e| {
                    eprintln!("❌ Upload error: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;

            println!("✅ Upload successful: {}", result.url);
            return Ok(Json(result));
        }
    }

    eprintln!("❌ No file field found in multipart data");
    Err(StatusCode::BAD_REQUEST)
}
