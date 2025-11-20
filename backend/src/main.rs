use axum::{
    Router,
    routing::{post, get},
    response::Html,
    Json,
    extract::DefaultBodyLimit,
};
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::cors::{CorsLayer, Any};
use http::HeaderValue;
use tower_http::services::ServeDir;
use dashmap::DashMap;

mod auth;
mod db;
mod redis_client;
mod websocket;
mod chat;
mod media;
mod expiration;
mod stories;
mod social;
mod settings;
mod discovery;
mod algorithm;
mod streaks;
mod notifications;
mod admin;

use redis_client::RedisClient;
use media::MediaService;
use expiration::ExpirationService;

pub struct AppState {
    pool: Arc<sqlx::PgPool>,
    redis: Arc<tokio::sync::Mutex<RedisClient>>,
    media_service: Arc<MediaService>,
    connections: websocket::Connections,
}

async fn serve_login() -> Html<String> {
    let html = tokio::fs::read_to_string("frontend/start.html")
        .await
        .unwrap_or_else(|_| "<h1>Error loading page</h1>".to_string());
    Html(html)
}

async fn serve_chat() -> Html<String> {
    let html = tokio::fs::read_to_string("frontend/basic-chat.html")
        .await
        .unwrap_or_else(|_| "<h1>Error loading page</h1>".to_string());
    Html(html)
}

async fn serve_test_chat() -> Html<String> {
    let html = tokio::fs::read_to_string("frontend/test-chat.html")
        .await
        .unwrap_or_else(|_| "<h1>Error loading page</h1>".to_string());
    Html(html)
}

async fn serve_stories() -> Html<String> {
    let html = tokio::fs::read_to_string("frontend/stories.html")
        .await
        .unwrap_or_else(|_| "<h1>Error loading page</h1>".to_string());
    Html(html)
}

async fn serve_create_story() -> Html<String> {
    let html = tokio::fs::read_to_string("frontend/create-story.html")
        .await
        .unwrap_or_else(|_| "<h1>Error loading page</h1>".to_string());
    Html(html)
}

async fn serve_admin_panel() -> Html<String> {
    let html = tokio::fs::read_to_string("frontend/admin-panel.html")
        .await
        .unwrap_or_else(|_| "<h1>Error loading page</h1>".to_string());
    Html(html)
}

async fn serve_advertise() -> Html<String> {
    let html = tokio::fs::read_to_string("frontend/advertise.html")
        .await
        .unwrap_or_else(|_| "<h1>Error loading page</h1>".to_string());
    Html(html)
}

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "relays.social",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok(); // Load .env because Rust refuses otherwise

    println!(" Starting RelayHub server...");

    // Initialize database pool
    let pool = Arc::new(db::init_pool().await);
    println!(" Database connected");

    // Initialize Redis
    let redis_url = std::env::var("REDIS_URL")
        .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let redis_client = RedisClient::new(&redis_url).await
        .expect("Failed to connect to Redis");
    let redis = Arc::new(tokio::sync::Mutex::new(redis_client));
    println!("✓ Redis connected");

    // Initialize media service (S3)
    let media_service = Arc::new(MediaService::new().await);
    println!("✓ S3 media service initialized");

    // Initialize WebSocket connections map
    let connections = Arc::new(DashMap::new());

    // Create app state
    let state = Arc::new(AppState {
        pool: pool.clone(),
        redis: redis.clone(),
        media_service: media_service.clone(),
        connections: connections.clone(),
    });

    // Start background expiration service
    let expiration_service = Arc::new(ExpirationService::new(
        pool.clone(),
        media_service.clone(),
    ));
    let expiration_service_clone = expiration_service.clone();
    tokio::spawn(async move {
        expiration_service_clone.start().await;
    });
    println!("✓ Message expiration service started");

    // Build router
    let app = Router::new()
        // Static pages
        .route("/", get(serve_login))
        .route("/test", get(serve_test_chat))
        .route("/chat", get(serve_chat))
        .route("/stories", get(serve_stories))
        .route("/create-story", get(serve_create_story))
        .route("/admin-panel", get(serve_admin_panel))
        .route("/advertise", get(serve_advertise))

        // Auth endpoints
        .route("/api/signup", post(auth::signup))
        .route("/api/login", post(auth::login))

        // Chat endpoints
        .route("/api/chats", post(chat::create_chat))
        .route("/api/users/:user_id/chats", get(chat::get_user_chats))
        .route("/api/users/:user_id/chats/:chat_room_id/messages", get(chat::get_messages))
        .route("/api/users/:user_id/messages/:message_id/view", post(chat::mark_message_viewed))
        .route("/api/users/:user_id/messages/:message_id/save", post(chat::save_message))
        .route("/api/users/:user_id/messages/:message_id/unsave", axum::routing::delete(chat::unsave_message))

        // Media upload endpoints (with increased body limit for file uploads)
        .route("/api/media/upload", post(media::upload_image))
        .route("/api/media/upload-multipart", post(media::upload_multipart))

        // Stories endpoints (also needs increased limit for media uploads)
        .route("/api/stories/create", post(stories::create_story_multipart))
        .route("/api/stories/user/:user_id", get(stories::get_user_stories))
        .route("/api/stories/feed/:viewer_id", get(stories::get_feed_stories))
        .route("/api/stories/by-user/:viewer_id", get(stories::get_stories_by_user))
        .route("/api/stories/:story_id/view/:viewer_id", post(stories::mark_story_viewed))
        .route("/api/stories/:story_id/delete/:user_id", axum::routing::delete(stories::delete_story))

        // Social endpoints - Follows
        .route("/api/social/follow/:follower_id/:following_id", post(social::follow_user))
        .route("/api/social/unfollow/:follower_id/:following_id", post(social::unfollow_user))
        .route("/api/social/follow-stats/:user_id/:viewer_id", get(social::get_follow_stats))
        .route("/api/social/followers/:user_id/:viewer_id", get(social::get_followers))
        .route("/api/social/following/:user_id/:viewer_id", get(social::get_following))

        // Social endpoints - Likes
        .route("/api/social/like/:story_id/:user_id", post(social::like_story))
        .route("/api/social/unlike/:story_id/:user_id", post(social::unlike_story))
        .route("/api/social/likes/:story_id", get(social::get_story_likes))

        // Social endpoints - Comments
        .route("/api/social/comment/:story_id/:user_id", post(social::add_comment))
        .route("/api/social/comments/:story_id", get(social::get_story_comments))
        .route("/api/social/comment/delete/:comment_id/:user_id", axum::routing::delete(social::delete_comment))
        
        // Social endpoints - Comment Replies
        .route("/api/social/reply/:story_id/:user_id", post(social::add_reply))
        .route("/api/social/replies/:comment_id", get(social::get_comment_replies))

        // Profile endpoints
        .route("/api/profile/:user_id/:viewer_id", get(social::get_user_profile))
        .route("/api/profile/:user_id/stories", get(social::get_user_stories))
        .route("/api/profile/:user_id/update", post(social::update_user_profile))

        // Settings endpoints
        .route("/api/settings/:user_id", get(settings::get_user_settings))
        .route("/api/settings/:user_id/username", post(settings::update_username))
        .route("/api/settings/:user_id/email", post(settings::update_email))
        .route("/api/settings/:user_id/password", post(settings::change_password))
        .route("/api/settings/:user_id/delete", axum::routing::delete(settings::delete_account))

        // Discovery endpoints
        .route("/api/discovery/search/:viewer_id", get(discovery::search_users))
        .route("/api/discovery/popular/:viewer_id", get(discovery::get_popular_users))
        .route("/api/discovery/suggested/:viewer_id", get(discovery::get_suggested_users))
        .route("/api/discovery/avatar/:user_id", post(discovery::update_avatar))
        .route("/api/discovery/refresh-popular", post(discovery::refresh_popular_users_view))

        // Algorithm/Feed endpoints
        .route("/api/feed/personalized/:user_id", get(algorithm::get_personalized_feed))
        .route("/api/feed/interaction/:user_id/:story_id", post(algorithm::record_interaction))
        .route("/api/feed/recalculate", post(algorithm::recalculate_all_feeds))

        // Streak endpoints
        .route("/api/streaks/update/:user1_id/:user2_id", post(streaks::update_streak))
        .route("/api/streaks/:user1_id/:user2_id", get(streaks::get_streak))
        .route("/api/streaks/user/:user_id", get(streaks::get_user_streaks))

        // Notification endpoints
        .route("/api/notifications/:user_id", get(notifications::get_notifications))
        .route("/api/notifications/:user_id/unread", get(notifications::get_unread_count))
        .route("/api/notifications/:user_id/:notification_id/read", post(notifications::mark_notification_read))
        .route("/api/notifications/:user_id/read-all", post(notifications::mark_all_notifications_read))
        .route("/api/notifications/:user_id/:notification_id", axum::routing::delete(notifications::delete_notification))

        // Admin endpoints (protected by AdminUser extractor)
        .route("/api/admin/users", get(admin::list_users))
        .route("/api/admin/users/:user_id/ban", post(admin::ban_user))
        .route("/api/admin/users/:user_id/unban", post(admin::unban_user))
        .route("/api/admin/users/:user_id/role", post(admin::change_user_role))
        .route("/api/admin/users/:user_id", axum::routing::delete(admin::delete_user))
        .route("/api/admin/logs", get(admin::get_admin_logs))
        .route("/api/admin/analytics", get(admin::get_analytics))
        .route("/api/admin/ads", get(admin::list_ads))
        .route("/api/admin/ads", post(admin::create_ad))
        .route("/api/admin/ads/:ad_id", axum::routing::patch(admin::update_ad))
        .route("/api/admin/ads/:ad_id", axum::routing::delete(admin::delete_ad))
        .route("/api/admin/ads/:ad_id/approve", post(admin::approve_ad))
        .route("/api/admin/ads/:ad_id/reject", post(admin::reject_ad))
        .route("/api/admin/ads/:ad_id/analytics/location", get(admin::get_ad_location_analytics))
        .route("/api/admin/ads/:ad_id/analytics/demographics", get(admin::get_ad_demographics_analytics))

        // Public ad endpoints (for showing ads to users)
        .route("/api/ads/next/:user_id", get(admin::get_next_ad))
        .route("/api/ads/:ad_id/impression/:user_id", post(admin::record_ad_impression))
        .route("/api/ads/:ad_id/click/:user_id", post(admin::record_ad_click))

        // Self-service ad creation endpoints
        .route("/api/ads/create", post(admin::create_ad_public))
        .route("/api/ads/:ad_id/checkout", post(admin::create_checkout_session))
        .route("/api/stripe/webhook", post(admin::stripe_webhook))

        // Health check endpoint
        .route("/health", get(health_check))

        // WebSocket endpoint
        .route("/ws/:user_id", get(websocket::ws_handler))

        .layer(DefaultBodyLimit::max(50 * 1024 * 1024)) // 50MB limit for uploads
        .layer(
            CorsLayer::new()
                .allow_origin([HeaderValue::from_static("https://relays.social")])
                .allow_methods(Any)
                .allow_headers(Any)
        )
        .with_state(state)
        // Serve static files from frontend directory as fallback
        .fallback_service(ServeDir::new("frontend"));

    // Get host and port from environment variables
    let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr = format!("{}:{}", host, port);

    let listener = TcpListener::bind(&addr).await.unwrap();
    println!("✓ Server running on {}", listener.local_addr().unwrap());
    println!("📱 WebSocket endpoint: ws://{}/ws/:user_id", addr);
    println!("💬 Ready for Snapchat-style messaging!\n");

    axum::serve(listener, app)
        .await
        .unwrap();
}
