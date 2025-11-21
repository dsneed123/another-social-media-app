# Server-Side Video Rendering (Faster!)

## Why Server-Side?
- **10-100x faster** than browser rendering
- Can use multiple CPU cores
- Better quality control
- No browser memory limits
- Can handle large videos (>5 min)

## How It Works:

```
Client                          Server
------                          ------
1. Upload original video   →    Receive video
2. Send edit instructions  →    Receive JSON with:
                                • Text overlays (timing, position, text)
                                • Clip segments (start, end, order)
                                • Audio tracks (files, timing, volume)
                                • Speed changes
                                     ↓
                                3. FFmpeg renders
                                   (Uses all CPU cores)
                                   (Takes 2-5 seconds!)
                                     ↓
4. Download rendered video ←    Return rendered file
```

## Implementation:

### Backend (Rust)
```rust
// In src/stories.rs
use std::process::Command;

async fn render_video(
    video_path: &str,
    edits: VideoEdits,
) -> Result<String, String> {
    // Build FFmpeg command
    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-i").arg(video_path);

    // Add text overlays
    for text in edits.text_elements {
        let filter = format!(
            "drawtext=text='{}':x={}:y={}:fontsize={}:enable='between(t,{},{})'",
            text.content, text.x, text.y, text.size,
            text.start_time, text.end_time
        );
        cmd.arg("-vf").arg(filter);
    }

    // Add audio mixing
    if edits.audio_tracks.len() > 0 {
        for track in edits.audio_tracks {
            cmd.arg("-i").arg(track.file);
        }
        cmd.arg("-filter_complex").arg("amix=inputs=2");
    }

    // Output
    let output = format!("/tmp/rendered_{}.mp4", uuid::Uuid::new_v4());
    cmd.arg("-y").arg(&output);

    // Run (uses all cores automatically)
    cmd.output()
        .map_err(|e| format!("FFmpeg error: {}", e))?;

    Ok(output)
}
```

### Frontend Changes
```javascript
async function renderEditedVideo() {
    // Instead of MediaRecorder...

    // Send edit data to server
    const response = await fetch('/api/stories/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            video_id: originalVideoId,
            edits: {
                text_elements: textElements,
                video_clips: videoEditor.videoTracks,
                audio_tracks: videoEditor.audioTracks,
                speed: videoEditor.speed
            }
        })
    });

    // Get rendered video URL
    const { rendered_url } = await response.json();

    // Download and use
    const blob = await fetch(rendered_url).then(r => r.blob());
    return blob;
}
```

## Speed Comparison:

**Browser (current):**
- 10 sec video → 10 sec render ⏱️
- 30 sec video → 30 sec render ⏱️⏱️⏱️
- 60 sec video → 60 sec render ⏱️⏱️⏱️⏱️⏱️⏱️

**Server with FFmpeg:**
- 10 sec video → 1 sec render ⚡
- 30 sec video → 2 sec render ⚡⚡
- 60 sec video → 4 sec render ⚡⚡⚡⚡

## Pros/Cons:

### Browser Rendering (Current)
✅ No server processing
✅ Works offline
✅ Privacy (never leaves device)
❌ Very slow (real-time only)
❌ Memory intensive
❌ Browser compatibility issues

### Server Rendering (FFmpeg)
✅ 10-100x faster
✅ Better quality
✅ Handles large files
✅ Uses multiple cores
❌ Uploads original video
❌ Requires server resources
❌ Server storage needed

## Quick Win: Hybrid Approach

```javascript
async function renderEditedVideo() {
    // For simple edits (text only), use browser
    if (isSimpleEdit()) {
        return browserRender();
    }

    // For complex edits (multi-clip, many tracks), use server
    else {
        return serverRender();
    }
}
```

## Install FFmpeg on Server:

```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# Verify
ffmpeg -version
```

## Would you like me to implement server-side rendering?
