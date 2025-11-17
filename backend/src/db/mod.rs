use sqlx::{PgPool, postgres::PgPoolOptions};
use std::env;

pub async fn init_pool() -> PgPool {
    // Check if DATABASE_URL is set (updated to use correct PostgreSQL database)
    let database_url = match env::var("DATABASE_URL") {
        Ok(url) => {
            println!("✓ DATABASE_URL found");
            println!("  Raw URL length: {} chars", url.len());
            println!("  URL starts with: {}", url.chars().take(15).collect::<String>());
            println!("  Connection host: {}", url.split('@').nth(1).and_then(|s| s.split('/').next()).unwrap_or("unknown"));
            
            if url.is_empty() {
                eprintln!("✗ DATABASE_URL is EMPTY!");
                panic!("DATABASE_URL is empty");
            }
            url
        }
        Err(_) => {
            eprintln!("✗ DATABASE_URL environment variable is not set!");
            eprintln!("Available env vars: {:?}", env::vars().map(|(k, _)| k).collect::<Vec<_>>());
            panic!("DATABASE_URL must be set");
        }
    };
    
    let mut database_url = database_url;
    
    println!("Attempting to connect to database...");
    
    // Remove sslmode if present and add sslmode=disable for internal DO connections
    // Digital Ocean's internal network doesn't require SSL
    if database_url.contains("sslmode=") {
        println!("  Removing existing sslmode parameter");
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
    println!("  Using sslmode=disable for internal network");
    
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await;
    
    match pool {
        Ok(p) => {
            println!("✓ Successfully connected to database");
            p
        }
        Err(e) => {
            eprintln!("✗ Failed to connect to database: {}", e);
            panic!("Failed to connect to DB: {:?}", e);
        }
    }
}
