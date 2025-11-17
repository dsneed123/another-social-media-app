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
    
    let database_url = database_url;
    
    println!("Attempting to connect to database...");
    
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .acquire_timeout(std::time::Duration::from_secs(10))
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
