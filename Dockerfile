# Production Dockerfile for relays.social backend

# Stage 1: Build - Use Debian base that matches runtime
FROM rust:1.75-bookworm AS builder

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files first for better caching
COPY backend/Cargo.toml ./

# Create dummy main.rs to build dependencies (Cargo will generate Cargo.lock)
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy actual source code
COPY backend/src ./src

# Copy sqlx offline query cache
COPY backend/.sqlx ./.sqlx

# Debug: Check environment
RUN echo "=== BUILD DEBUG INFO ===" && \
    echo "SQLX_OFFLINE will be set to: true" && \
    echo "DATABASE_URL is set: $(if [ -n "$DATABASE_URL" ]; then echo YES; else echo NO; fi)" && \
    echo ".sqlx directory contents:" && \
    ls -la .sqlx/ 2>&1 | head -10 && \
    echo "======================="

# Build the application with offline mode (no DATABASE_URL needed at build time)
ENV SQLX_OFFLINE=true
RUN cargo build --release

# Stage 2: Runtime - Use same Debian version as builder
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
