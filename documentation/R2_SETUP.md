# Cloudflare R2 Setup Guide

This guide will help you configure RelayHub to use Cloudflare R2 for media storage instead of AWS S3.

## Why R2?

- **Zero egress fees** - No charges for data transfer out
- **S3-compatible** - Works with existing S3 SDKs
- **Cost-effective** - ~$0.015/GB/month storage
- **Fast global access** - Cloudflare's edge network
- **No API request fees** for Class A operations

## Step 1: Create R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** in the left sidebar
3. Click **Create bucket**
4. Enter bucket name: `relayhub-media` (or your preferred name)
5. Click **Create bucket**

## Step 2: Get API Credentials

1. In R2 dashboard, click **Manage R2 API Tokens**
2. Click **Create API token**
3. Configure the token:
   - **Token name**: `relayhub-backend`
   - **Permissions**:
     - ✅ Object Read & Write
     - ✅ (Optional) Admin Read & Write if you want bucket management
   - **TTL**: Forever (or set expiration as needed)
   - **Bucket scope**: Select `relayhub-media` bucket
4. Click **Create API Token**
5. **Save these values** (you won't see them again):
   - Access Key ID
   - Secret Access Key
   - Endpoint URL (format: `https://<account-id>.r2.cloudflarestorage.com`)

## Step 3: Configure Public Access (Optional)

For direct public access to images without going through your backend:

### Option A: R2.dev Subdomain (Free)
1. Go to your bucket settings
2. Under **Public access**, click **Allow Access**
3. Enable **R2.dev subdomain**
4. You'll get a URL like: `https://pub-xxxxxxxxxxxxx.r2.dev`
5. Copy this URL for your `.env` file

### Option B: Custom Domain (Recommended for Production)
1. Go to bucket settings
2. Click **Connect Domain**
3. Enter your custom domain (e.g., `media.yoursite.com`)
4. Add the CNAME record to your DNS:
   ```
   media.yoursite.com CNAME <your-bucket>.r2.cloudflarestorage.com
   ```
5. Wait for DNS propagation
6. Use `https://media.yoursite.com` as your R2_PUBLIC_URL

## Step 4: Configure CORS (Important!)

R2 needs CORS configured to allow browser uploads:

1. In your bucket settings, click **Settings**
2. Scroll to **CORS Policy**
3. Add this configuration:

```json
[
  {
    "AllowedOrigins": [
      "http://127.0.0.1:3000",
      "http://localhost:3000",
      "https://yourdomain.com"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

4. Click **Save**

## Step 5: Update Your .env File

Create or update `backend/.env`:

```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/relayhub

# Redis
REDIS_URL=redis://127.0.0.1:6379

# Cloudflare R2 Configuration
AWS_REGION=auto
AWS_ACCESS_KEY_ID=your_r2_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_r2_secret_access_key_here
S3_BUCKET_NAME=relayhub-media

# R2 Endpoint (REQUIRED - get from API token creation)
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com

# R2 Public URL (OPTIONAL - only if you enabled public access)
# Use R2.dev subdomain OR custom domain
R2_PUBLIC_URL=https://pub-xxxxxxxxxxxxx.r2.dev
# OR
# R2_PUBLIC_URL=https://media.yoursite.com

# JWT Secret
JWT_SECRET=your_secret_here
```

### Finding Your Values:

- **Account ID**: Found in R2 dashboard URL or API token page
- **R2_ENDPOINT**: Shown when you create the API token
  - Format: `https://<account-id>.r2.cloudflarestorage.com`
- **R2_PUBLIC_URL**:
  - R2.dev: Found in bucket settings under "Public R2.dev Bucket URL"
  - Custom: Your custom domain (e.g., `https://media.yoursite.com`)

## Step 6: Test the Configuration

1. Start your backend:
   ```bash
   cd backend
   cargo run
   ```

2. You should see:
   ```
   ✓ Using Cloudflare R2 at https://xxxxx.r2.cloudflarestorage.com
   ```

3. Test image upload:
   - Open http://127.0.0.1:3000/chat
   - Click the camera button
   - Take a photo
   - Send the message

4. Verify in R2:
   - Go to your R2 bucket
   - You should see uploaded files under `messages/`

## Troubleshooting

### "Failed to upload to S3/R2" Error

**Check:**
- ✅ Access Key ID and Secret are correct
- ✅ R2_ENDPOINT is set correctly
- ✅ Bucket name matches exactly
- ✅ API token has write permissions for the bucket

**Test connection:**
```bash
# Install aws CLI (configured for R2)
aws s3 ls --endpoint-url https://your-account-id.r2.cloudflarestorage.com s3://relayhub-media
```

### CORS Errors in Browser

**Check:**
- ✅ CORS policy is configured in R2 bucket
- ✅ Your domain is in AllowedOrigins
- ✅ Methods include GET, PUT, POST

### Images Not Loading

**Public access required:**
- If using R2_PUBLIC_URL, ensure public access is enabled
- Check that R2.dev subdomain or custom domain is active
- Test direct URL access: `https://pub-xxx.r2.dev/messages/test.jpg`

**Private access:**
- If NOT using R2_PUBLIC_URL, you'll need signed URLs (not currently implemented)
- Either enable public access or implement presigned URLs

### "No such bucket" Error

**Check:**
- ✅ Bucket name in .env matches R2 bucket name exactly
- ✅ Bucket exists in your R2 dashboard
- ✅ API token has access to this specific bucket

## Cost Comparison

### Cloudflare R2
- Storage: $0.015/GB/month
- Class A operations (write): $4.50/million
- Class B operations (read): $0.36/million
- **Egress: $0** (FREE!)

### AWS S3 (for comparison)
- Storage: $0.023/GB/month
- PUT requests: $5/million
- GET requests: $0.40/million
- **Egress: $0.09/GB** (expensive!)

### Example: 100GB storage, 1M reads, 100K writes/month
- **R2**: ~$1.50 + $0.45 = **$1.95/month**
- **S3**: ~$2.30 + $0.40 + $0.50 + egress = **$3.20+ /month**

For high-traffic apps with lots of image downloads, R2 can save 70-90% on costs!

## R2 Limits (as of 2024)

- Max object size: **5 TB** per object
- Max bucket size: **Unlimited**
- Max buckets: **1000** per account
- Request rate: **No hard limit** (fair usage)
- Free tier: **10 GB storage/month free**

## Production Recommendations

1. **Use Custom Domain**
   - Better branding
   - More control
   - Can switch providers without changing URLs

2. **Enable R2 Analytics**
   - Monitor usage in Cloudflare dashboard
   - Track request patterns
   - Optimize costs

3. **Set Lifecycle Rules** (if needed)
   - Auto-delete expired media
   - Move to cold storage (when R2 adds this)

4. **CDN Integration**
   - R2 already uses Cloudflare's edge network
   - No additional CDN needed!

5. **Backups**
   - Enable R2 versioning (when available)
   - Or periodic backups to another storage

## Migration from S3 to R2

If you already have data in S3:

```bash
# Use rclone to migrate
rclone copy s3:old-bucket r2:relayhub-media --progress

# Or AWS CLI with R2 endpoint
aws s3 sync s3://old-bucket s3://relayhub-media \
  --endpoint-url https://account-id.r2.cloudflarestorage.com
```

## Support

- [R2 Documentation](https://developers.cloudflare.com/r2/)
- [R2 Community](https://community.cloudflare.com/c/developers/r2-object-storage/)
- [Pricing](https://developers.cloudflare.com/r2/pricing/)

---

**That's it! Your RelayHub is now using Cloudflare R2 for blazing-fast, cost-effective media storage! 🚀**
