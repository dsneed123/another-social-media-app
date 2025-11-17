use axum::{
    extract::{Json, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use jsonwebtoken::{encode, EncodingKey, Header};
use argon2::{Argon2, PasswordHash, PasswordVerifier, PasswordHasher};
use rand_core::OsRng;
use chrono::Utc;
use std::sync::Arc;

#[derive(Serialize, Deserialize)]
struct Claims {
    sub: Uuid,
    exp: usize,
}

#[derive(Deserialize)]
pub struct SignupInput {
    username: String,
    email: String,
    password: String,
}

#[derive(Deserialize)]
pub struct LoginInput {
    username: String,
    password: String,
}

// Signup handler
#[axum::debug_handler]
pub async fn signup(
    State(state): State<Arc<crate::AppState>>,
    Json(payload): Json<SignupInput>,
) -> Result<Json<LoginResponse>, (StatusCode, String)> {
    // Hash the password
    let salt = argon2::password_hash::SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2.hash_password(payload.password.as_bytes(), &salt)
        .map_err(|e| {
            eprintln!("Failed to hash password: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create account".to_string())
        })?
        .to_string();

    // Insert user into database
    let user = sqlx::query!("INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email",
        payload.username,
        payload.email,
        password_hash
    )
    .fetch_one(state.pool.as_ref())
    .await
    .map_err(|e| {
        eprintln!("Failed to create user: {:?}", e);
        if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
            (StatusCode::CONFLICT, "Username or email already exists".to_string())
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create account".to_string())
        }
    })?;

    // Generate JWT token
    let claims = Claims {
        sub: user.id,
        exp: (Utc::now().timestamp() + 3600) as usize,
    };

    let token = encode(&Header::default(), &claims, &EncodingKey::from_secret("supersecret".as_ref()))
        .map_err(|e| {
            eprintln!("Failed to generate token: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Authentication error".to_string())
        })?;

    Ok(Json(LoginResponse {
        token,
        user_id: user.id,
        username: user.username,
        email: user.email,
    }))
}

#[derive(Serialize)]
pub struct LoginResponse {
    token: String,
    user_id: Uuid,
    username: String,
    email: String,
}

// Login handler
#[axum::debug_handler]
pub async fn login(
    State(state): State<Arc<crate::AppState>>,
    Json(payload): Json<LoginInput>,
) -> Result<Json<LoginResponse>, (StatusCode, String)> {
    // Find user by username
    let row = sqlx::query!("SELECT id, username, email, password_hash FROM users WHERE username = $1", payload.username)
        .fetch_one(state.pool.as_ref())
        .await
        .map_err(|e| {
            eprintln!("User not found: {:?}", e);
            (StatusCode::UNAUTHORIZED, "Invalid username or password".to_string())
        })?;

    // Verify password
    let parsed_hash = PasswordHash::new(&row.password_hash)
        .map_err(|e| {
            eprintln!("Failed to parse password hash: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Authentication error".to_string())
        })?;
    
    Argon2::default()
        .verify_password(payload.password.as_bytes(), &parsed_hash)
        .map_err(|e| {
            eprintln!("Password verification failed: {:?}", e);
            (StatusCode::UNAUTHORIZED, "Invalid username or password".to_string())
        })?;

    // Generate JWT token
    let claims = Claims {
        sub: row.id,
        exp: (Utc::now().timestamp() + 3600) as usize,
    };

    let token = encode(&Header::default(), &claims, &EncodingKey::from_secret("supersecret".as_ref()))
        .map_err(|e| {
            eprintln!("Failed to generate token: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Authentication error".to_string())
        })?;

    Ok(Json(LoginResponse {
        token,
        user_id: row.id,
        username: row.username,
        email: row.email,
    }))
}
