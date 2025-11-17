use sqlx::{PgPool, postgres::PgPoolOptions};
use std::env;

pub async fn init_pool() -> PgPool {
    let mut database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    
    // Ensure SSL mode is set for production databases
    // Digital Ocean managed databases require SSL
    if !database_url.contains("sslmode=") {
        let separator = if database_url.contains('?') { "&" } else { "?" };
        database_url.push_str(&format!("{}sslmode=require", separator));
    }
    
    PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to DB")
}
