# Installing FFmpeg in Production

## ✅ Option 1: Docker (Recommended)

**I've already updated your Dockerfiles!** Just rebuild and redeploy:

### If Using Docker Compose:
```bash
# Rebuild with FFmpeg included
docker-compose build --no-cache

# Restart services
docker-compose up -d

# Verify FFmpeg is installed
docker-compose exec backend ffmpeg -version
```

### If Using Docker Directly:
```bash
# Build production image
docker build -f backend/Dockerfile.prod -t your-app:latest .

# Run container
docker run -d -p 3000:3000 your-app:latest

# Verify FFmpeg
docker exec <container-id> ffmpeg -version
```

### What I Changed:
- ✅ Added `ffmpeg` to `Dockerfile` (line 41)
- ✅ Added `ffmpeg` to `Dockerfile.prod` (line 42)
- ✅ Added `curl` for healthchecks

**Next deploy will automatically include FFmpeg!**

---

## Option 2: Direct SSH Installation

If you're NOT using Docker and running directly on the server:

### Ubuntu/Debian:
```bash
# Connect to production server
ssh your-server

# Update packages
sudo apt-get update

# Install FFmpeg
sudo apt-get install -y ffmpeg

# Verify installation
ffmpeg -version

# Should show:
# ffmpeg version 5.1.x
```

### RedHat/CentOS/Rocky Linux:
```bash
ssh your-server

# Enable EPEL repository
sudo yum install -y epel-release

# Install FFmpeg
sudo yum install -y ffmpeg

# Verify
ffmpeg -version
```

### Amazon Linux 2023:
```bash
ssh your-server

# Install FFmpeg
sudo dnf install -y ffmpeg

# Verify
ffmpeg -version
```

---

## Option 3: Cloud Platform Specific

### Railway:
1. Add to your `nixpacks.toml` (if using Nix):
```toml
[phases.setup]
nixPkgs = ["ffmpeg"]
```

2. Or use Dockerfile deployment (already configured above)

### Render:
1. Use Docker deployment (already configured)
2. Or add to build command:
```bash
apt-get install -y ffmpeg && cargo build --release
```

### Heroku:
1. Add FFmpeg buildpack:
```bash
heroku buildpacks:add https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest.git
```

2. Or use Docker deployment (already configured)

### DigitalOcean App Platform:
1. Use Dockerfile deployment (already configured)
2. FFmpeg will be installed automatically

### AWS ECS/EC2:
1. Use Docker image (already configured)
2. Or SSH and install:
```bash
sudo yum install -y ffmpeg  # Amazon Linux
# OR
sudo apt-get install -y ffmpeg  # Ubuntu
```

### Google Cloud Run:
1. Use Dockerfile deployment (already configured)
2. FFmpeg included in container

---

## Verification Steps

After installation, verify FFmpeg is working:

### 1. Check Version:
```bash
# On server
ffmpeg -version

# In Docker
docker exec <container> ffmpeg -version

# Should output:
# ffmpeg version 5.1.x (or higher)
# configuration: --enable-gpl --enable-version3...
```

### 2. Test Basic Render:
```bash
# Create test video
ffmpeg -f lavfi -i testsrc=duration=5:size=1280x720:rate=30 -pix_fmt yuv420p test.mp4

# Should create test.mp4 without errors
```

### 3. Test Text Overlay (What Your App Uses):
```bash
ffmpeg -i test.mp4 -vf "drawtext=text='Hello':x=100:y=100:fontsize=48:fontcolor=white" output.mp4

# Should create output.mp4 with text
```

### 4. Check From Your App:
```bash
# Restart your backend
# Check logs for:
# "✓ Bucket cleanup service started"

# Try rendering a video in the app
# Console should show:
# "✅ Server render complete: { render_time_seconds: 2.43 }"
```

---

## Troubleshooting

### Error: "ffmpeg: command not found"

**In Docker:**
```bash
# Rebuild image
docker build --no-cache -f backend/Dockerfile.prod -t app:latest .

# Verify in container
docker run --rm -it app:latest ffmpeg -version
```

**On Server:**
```bash
# Check if installed
which ffmpeg

# If not found, install:
sudo apt-get update && sudo apt-get install -y ffmpeg
```

### Error: "libx264 not found"

**Solution:** Use system FFmpeg (already configured in our code)
```bash
# Verify codecs available
ffmpeg -codecs | grep h264

# Should show:
# DEV.LS h264     H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (decoders: h264 )
```

### Error: "Failed to open video file"

**Check permissions:**
```bash
# In Docker, make sure temp directory is writable
docker exec <container> ls -la /tmp

# Should show drwxrwxrwt (world writable)
```

### Render endpoint returns 500

**Check backend logs:**
```bash
# Docker
docker logs <container-id>

# Direct
journalctl -u your-app -f

# Look for FFmpeg errors:
# "❌ FFmpeg failed:"
# "STDERR: [error details]"
```

---

## Testing After Installation

### 1. Test Server Endpoint:
```bash
curl -X POST http://your-server:3000/api/stories/render \
  -F "user_id=<uuid>" \
  -F "video=@test.mp4" \
  -F "text_elements=[{\"content\":\"Test\",\"x\":100,\"y\":100,\"font_size\":48,\"color\":\"white\",\"start_time\":1,\"end_time\":3}]"

# Should return:
# {
#   "render_id": "...",
#   "video_url": "https://...",
#   "render_time_seconds": 2.43
# }
```

### 2. Test From Frontend:
1. Upload a video
2. Add text overlay
3. Click "Done" → "OK"
4. Check console for:
   - "✅ Server render complete: { render_time_seconds: 2.43 }"
   - NOT "⚠️ Server rendering failed"

### 3. Verify Output:
1. Download rendered video
2. Play in browser
3. Confirm text appears at correct times

---

## Performance Check

After installation, you should see:

**Before (Browser Rendering):**
```
Rendering 30s video... 30 seconds
```

**After (Server Rendering):**
```
Server is rendering... 2-3 seconds ⚡
```

### Monitor Server Resources:

```bash
# CPU usage during render (should spike to 100%)
top

# Memory usage
free -h

# Check render times in logs
grep "Render time:" /var/log/your-app.log
# Or
docker logs <container> | grep "Render time:"

# Should show:
# ⏱️ Render time: 2.43s
# ⏱️ Render time: 1.87s
```

---

## Production Checklist

- [ ] FFmpeg installed (Docker or server)
- [ ] Dockerfile updated with FFmpeg
- [ ] Container rebuilt and redeployed
- [ ] `ffmpeg -version` works
- [ ] Test render successful
- [ ] Frontend sees fast render times
- [ ] Cleanup service running (check logs)
- [ ] Monitor server resources

---

## Deployment Commands

### Deploy with Docker:
```bash
# 1. Build
docker build -f backend/Dockerfile.prod -t registry.example.com/your-app:latest .

# 2. Push to registry
docker push registry.example.com/your-app:latest

# 3. Pull on production
ssh production-server
docker pull registry.example.com/your-app:latest

# 4. Restart
docker-compose down
docker-compose up -d

# 5. Verify
docker-compose exec backend ffmpeg -version
docker-compose logs -f backend | grep "Bucket cleanup"
```

### Deploy with Git:
```bash
# On production server
cd /path/to/app
git pull origin main

# If using Docker
docker-compose build --no-cache
docker-compose up -d

# If running directly
cargo build --release
sudo systemctl restart your-app
```

---

## Cost Considerations

### FFmpeg Resource Usage:
- **CPU**: 1-2 cores @ 100% during render (2-5 seconds)
- **Memory**: ~500MB per concurrent render
- **Storage**: Temp files (~2x video size, deleted after render)

### Recommendations:
- **Min Server**: 2 vCPU, 2GB RAM (handles 2-3 concurrent renders)
- **Recommended**: 4 vCPU, 4GB RAM (handles 5-8 concurrent renders)
- **Scale**: Use queue system for >10 concurrent renders

### Render Limits:
Add to prevent abuse:
```rust
// In video_render.rs
const MAX_VIDEO_DURATION: f64 = 300.0; // 5 minutes
const MAX_FILE_SIZE: usize = 500 * 1024 * 1024; // 500MB

if video_duration > MAX_VIDEO_DURATION {
    return Err(StatusCode::BAD_REQUEST);
}
```

---

## Summary

**✅ For Docker (Most Common):**
1. Your Dockerfiles are already updated with FFmpeg
2. Just rebuild: `docker-compose build --no-cache`
3. Redeploy: `docker-compose up -d`
4. Verify: `docker-compose exec backend ffmpeg -version`

**✅ For Direct Server:**
1. SSH to production
2. Run: `sudo apt-get install -y ffmpeg`
3. Verify: `ffmpeg -version`
4. Restart app

**That's it!** Your server-side rendering will work automatically once FFmpeg is installed.
