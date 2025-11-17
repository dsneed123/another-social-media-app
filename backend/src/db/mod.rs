use sqlx::{PgPool, postgres::PgPoolOptions};
use std::env;

pub async fn init_pool() -> PgPool {
    let mut database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    
    println!("Attempting to connect to database...");
    
    // Remove sslmode if present and add sslmode=disable for internal DO connections
    // Digital Ocean's internal network doesn't require SSL
    if database_url.contains("sslmode=") {
        // Remove existing sslmode parameter
        let parts: Vec<&str> = database_url.split('?').collect();
        if parts.len() > 1 {
            let base = parts[0];
            let params: Vec<&str> = parts[1].split('&')
                .filter(|p| !p.starts_with("sslmode="))
                .collect();
            database_url = if params.is_empty() {
                base.to_string()
            } else {
                format!("{}?{}", base, params.join("&"))
            };
        }
    }
    
    // Add sslmode=disable for internal network connection
    let separator = if database_url.contains('?') { "&" } else { "?" };
    database_url.push_str(&format!("{}sslmode=disable", separator));
    
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await;
    
    match pool {
        Ok(p) => {
            println!("Successfully connected to database");
            p
        }
        Err(e) => {
            eprintln!("Failed to connect to database: {}", e);
            panic!("Failed to connect to DB: {:?}", e);
        }
    }
}
