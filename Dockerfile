# Production Dockerfile for relays.social backend

# Use nightly for edition2024 support
FROM rustlang/rust:nightly-slim AS builder

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files first for better caching
COPY backend/Cargo.toml backend/Cargo.lock ./

# Create dummy main.rs to build dependencies
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy actual source code
COPY backend/src ./src

# Build the application (requires DATABASE_URL at build time)
# DATABASE_URL is set by DigitalOcean with scope: RUN_AND_BUILD_TIME
# SQLx will connect to the database during build to verify queries
ENV SQLX_OFFLINE=false
RUN cargo build --release

# Stage 2: Runtime
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Copy the built binary from builder
COPY --from=builder /app/target/release/backend /app/backend

# Copy frontend files
COPY frontend /app/frontend

# Copy migrations
COPY backend/migrations /app/migrations

# Create non-root user
RUN useradd -m -u 1000 relay && \
    chown -R relay:relay /app

USER relay

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Run the application
CMD ["/app/backend"]
