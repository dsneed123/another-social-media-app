use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::AppState;
use argon2::{Argon2, PasswordHash, PasswordVerifier, PasswordHasher};
use argon2::password_hash::SaltString;
use rand_core::OsRng;

#[derive(Deserialize)]
pub struct UpdateUsernameRequest {
    pub username: String,
}

#[derive(Deserialize)]
pub struct UpdateEmailRequest {
    pub email: String,
}

#[derive(Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Serialize)]
pub struct UserSettingsResponse {
    pub username: String,
    pub email: String,
}

// Get user settings (username and email)
pub async fn get_user_settings(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
) -> Result<Json<UserSettingsResponse>, StatusCode> {
    let user_uuid = uuid::Uuid::parse_str(&user_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let user = sqlx::query!(
        "SELECT username, email FROM users WHERE id = $1",
        user_uuid
    )
    .fetch_optional(&*state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(UserSettingsResponse {
        username: user.username,
        email: user.email,
    }))
}

// Update username
pub async fn update_username(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
    Json(payload): Json<UpdateUsernameRequest>,
) -> Result<StatusCode, StatusCode> {
    let user_uuid = uuid::Uuid::parse_str(&user_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    if payload.username.is_empty() || payload.username.len() > 30 {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Check if username is already taken
    let existing = sqlx::query!(
        "SELECT id FROM users WHERE username = $1 AND id != $2",
        payload.username,
        user_uuid
    )
    .fetch_optional(&*state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if existing.is_some() {
        return Err(StatusCode::CONFLICT);
    }

    sqlx::query!(
        "UPDATE users SET username = $1 WHERE id = $2",
        payload.username,
        user_uuid
    )
    .execute(&*state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

// Update email
pub async fn update_email(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
    Json(payload): Json<UpdateEmailRequest>,
) -> Result<StatusCode, StatusCode> {
    let user_uuid = uuid::Uuid::parse_str(&user_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    if payload.email.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Basic email validation
    if !payload.email.contains('@') || !payload.email.contains('.') {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Check if email is already taken
    let existing = sqlx::query!(
        "SELECT id FROM users WHERE email = $1 AND id != $2",
        payload.email,
        user_uuid
    )
    .fetch_optional(&*state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if existing.is_some() {
        return Err(StatusCode::CONFLICT);
    }

    sqlx::query!(
        "UPDATE users SET email = $1 WHERE id = $2",
        payload.email,
        user_uuid
    )
    .execute(&*state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

// Change password
pub async fn change_password(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
    Json(payload): Json<ChangePasswordRequest>,
) -> Result<StatusCode, StatusCode> {
    let user_uuid = uuid::Uuid::parse_str(&user_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    if payload.new_password.len() < 6 {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Get current password hash
    let user = sqlx::query!(
        "SELECT password_hash FROM users WHERE id = $1",
        user_uuid
    )
    .fetch_optional(&*state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    // Verify current password
    let argon2 = Argon2::default();
    let parsed_hash = PasswordHash::new(&user.password_hash)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let valid = argon2.verify_password(payload.current_password.as_bytes(), &parsed_hash).is_ok();

    if !valid {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Hash new password
    let salt = SaltString::generate(&mut OsRng);
    let new_hash = argon2.hash_password(payload.new_password.as_bytes(), &salt)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .to_string();

    // Update password
    sqlx::query!(
        "UPDATE users SET password_hash = $1 WHERE id = $2",
        new_hash,
        user_uuid
    )
    .execute(&*state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

// Delete account
pub async fn delete_account(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let user_uuid = uuid::Uuid::parse_str(&user_id)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    // Delete user (cascading deletes will handle related data)
    sqlx::query!(
        "DELETE FROM users WHERE id = $1",
        user_uuid
    )
    .execute(&*state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}
