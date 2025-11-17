# Deployment Guide for relays.social on DigitalOcean

This guide will help you deploy your Snapchat-style social media app to DigitalOcean with the domain `relays.social`.

## Prerequisites

- DigitalOcean account
- Domain name `relays.social` pointed to your droplet's IP
- SSH access to your droplet

## 1. DigitalOcean Droplet Setup

### Recommended Specs
- **Droplet Size**: Basic Plan ($12/month or higher)
  - 2 GB RAM / 1 CPU
  - 50 GB SSD
- **OS**: Ubuntu 22.04 LTS

### Create Droplet
1. Log into DigitalOcean
2. Create Droplet > Ubuntu 22.04
3. Add your SSH key
4. Choose a datacenter region close to your users

## 2. Initial Server Setup

SSH into your droplet:
```bash
ssh root@your-droplet-ip
```

### Update system
```bash
apt update && apt upgrade -y
```

### Create a non-root user
```bash
adduser relay
usermod -aG sudo relay
su - relay
```

## 3. Install Dependencies

### Install Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### Install PostgreSQL
```bash
sudo apt install postgresql postgresql-contrib -y
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Install Redis
```bash
sudo apt install redis-server -y
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### Install Nginx
```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Install Certbot (for SSL)
```bash
sudo apt install certbot python3-certbot-nginx -y
```

## 4. Database Setup

### Create PostgreSQL database and user
```bash
sudo -u postgres psql
```

In PostgreSQL:
```sql
CREATE DATABASE relayhub;
CREATE USER relayhub_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE relayhub TO relayhub_user;
\q
```

### Configure PostgreSQL for remote connections (if needed)
```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
# Set: listen_addresses = 'localhost'

sudo nano /etc/postgresql/14/main/pg_hba.conf
# Add: local   relayhub    relayhub_user                   md5

sudo systemctl restart postgresql
```

## 5. Deploy Application

### Clone or upload your repository
```bash
cd /home/relay
# Option 1: Clone from git
git clone your-repository-url another-social-media-app

# Option 2: Upload via SCP
# From your local machine:
# scp -r another-social-media-app relay@your-droplet-ip:/home/relay/
```

### Configure environment
```bash
cd another-social-media-app/backend
cp .env.production .env
nano .env
```

Update the following in `.env`:
```bash
HOST=0.0.0.0
PORT=3000
CORS_ORIGIN=https://relays.social

DATABASE_URL=postgres://relayhub_user:your_secure_password@localhost/relayhub
JWT_SECRET=generate_a_secure_random_string_here

REDIS_URL=redis://127.0.0.1:6379

# Your Cloudflare R2 credentials (already configured)
```

### Run database migrations
```bash
cd /home/relay/another-social-media-app/backend
cargo install sqlx-cli --no-default-features --features postgres

# Run all migrations
for migration in migrations/*.sql; do
    psql -U relayhub_user -d relayhub -f "$migration"
done
```

### Build the application
```bash
cd /home/relay/another-social-media-app/backend
cargo build --release
```

## 6. Create Systemd Service

Create a service file to run the app automatically:

```bash
sudo nano /etc/systemd/system/relays.service
```

Add this content:
```ini
[Unit]
Description=Relays Social Media Backend
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=relay
WorkingDirectory=/home/relay/another-social-media-app/backend
Environment="PATH=/home/relay/.cargo/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/home/relay/another-social-media-app/backend/target/release/backend
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable relays
sudo systemctl start relays
sudo systemctl status relays
```

## 7. Configure Nginx

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/relays.social
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name relays.social www.relays.social;

    # Redirect HTTP to HTTPS (will be configured by certbot)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name relays.social www.relays.social;

    # SSL certificates (certbot will add these)
    # ssl_certificate ...
    # ssl_certificate_key ...

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Root directory for static files
    root /home/relay/another-social-media-app/frontend;
    index start.html;

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket endpoint
    location /ws/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    # Serve static frontend files
    location / {
        try_files $uri $uri/ /start.html;
    }

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/relays.social /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 8. Setup SSL with Let's Encrypt

```bash
sudo certbot --nginx -d relays.social -d www.relays.social
```

Follow the prompts to:
1. Enter your email
2. Agree to Terms of Service
3. Choose to redirect HTTP to HTTPS (recommended)

Certbot will automatically:
- Obtain SSL certificates
- Configure Nginx to use them
- Set up auto-renewal

Test auto-renewal:
```bash
sudo certbot renew --dry-run
```

## 9. Configure Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## 10. Configure Domain DNS

In your domain registrar (e.g., Namecheap, GoDaddy), add these DNS records:

| Type  | Name | Value              | TTL  |
|-------|------|--------------------|------|
| A     | @    | your-droplet-ip    | 300  |
| A     | www  | your-droplet-ip    | 300  |

Wait 5-30 minutes for DNS propagation.

## 11. Monitoring and Maintenance

### View logs
```bash
# Application logs
sudo journalctl -u relays -f

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Restart services
```bash
sudo systemctl restart relays
sudo systemctl restart nginx
```

### Update application
```bash
cd /home/relay/another-social-media-app
git pull  # or upload new files
cd backend
cargo build --release
sudo systemctl restart relays
```

## 12. Optional: Database Backups

Create a backup script:

```bash
mkdir -p /home/relay/backups
nano /home/relay/backup.sh
```

Add:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U relayhub_user relayhub > /home/relay/backups/backup_$DATE.sql
find /home/relay/backups -name "backup_*.sql" -mtime +7 -delete
```

Make executable and add to cron:
```bash
chmod +x /home/relay/backup.sh
crontab -e
# Add: 0 2 * * * /home/relay/backup.sh
```

## 13. Optional: Redis Persistence

Configure Redis to persist data:

```bash
sudo nano /etc/redis/redis.conf
```

Ensure these settings:
```
save 900 1
save 300 10
save 60 10000
appendonly yes
```

Restart Redis:
```bash
sudo systemctl restart redis-server
```

## Troubleshooting

### Backend won't start
```bash
sudo journalctl -u relays -n 50
# Check for database connection errors or missing environment variables
```

### WebSocket connections failing
- Check nginx WebSocket configuration
- Ensure firewall allows connections
- Verify CORS settings in backend .env

### Database connection issues
```bash
sudo -u postgres psql
\l  # List databases
\du  # List users
```

### SSL certificate issues
```bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

## Performance Optimization

### Enable gzip compression in Nginx
Add to your server block:
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

### Increase file upload limits
In `/etc/nginx/nginx.conf`:
```nginx
client_max_body_size 20M;
```

### PostgreSQL tuning
```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
```

Adjust based on your RAM:
```
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
```

## Support

For issues or questions:
- Check application logs: `sudo journalctl -u relays -f`
- Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
- Verify environment variables in `/home/relay/another-social-media-app/backend/.env`

## Security Checklist

- [x] SSL certificates installed
- [x] Firewall configured
- [x] Database using strong password
- [x] JWT_SECRET is unique and secure
- [x] Regular backups configured
- [x] Non-root user running application
- [x] CORS configured for production domain
- [x] PostgreSQL not exposed to internet
- [x] Redis not exposed to internet
