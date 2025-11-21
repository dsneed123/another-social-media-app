# Video Editor Integration Guide

## Files Created
1. `frontend/video-editor.css` - All styles (mobile-first)
2. `frontend/video-editor.js` - All JavaScript logic
3. `frontend/video-editor-ui.html` - HTML structure

## How to Integrate into create-story.html

### Step 1: Add CSS and JS to Head

Add these lines in the `<head>` section of `create-story.html`:

```html
<link rel="stylesheet" href="/video-editor.css">
<script src="/video-editor.js"></script>
```

### Step 2: Add HTML Structure

Copy all the content from `video-editor-ui.html` and paste it at the end of the `<body>` in `create-story.html`, just before the closing `</body>` tag.

### Step 3: Add "Advanced Edit" Button

In the existing editing tools section, add a button to open the video editor:

```html
<button class="tool-btn" onclick="openAdvancedVideoEditor()" id="advanced-edit-btn" style="display: none;">
    <i class="bi bi-sliders"></i>
    <span>Advanced Edit</span>
</button>
```

### Step 4: Add Integration Function

Add this JavaScript function to your existing script section:

```javascript
function openAdvancedVideoEditor() {
    if (!isVideo) {
        alert('Advanced editor is only available for videos');
        return;
    }

    // Get the video source
    const video = document.getElementById('preview-video');
    const videoSrc = video.src;

    // Open the video editor with current text elements
    openVideoEditor(videoSrc, textElements);
}

// Show/hide advanced edit button based on media type
function handleFileSelect(e) {
    // ... existing code ...

    isVideo = file.type.startsWith('video/');

    // Show advanced edit button for videos
    const advancedEditBtn = document.getElementById('advanced-edit-btn');
    if (advancedEditBtn) {
        advancedEditBtn.style.display = isVideo ? 'flex' : 'none';
    }

    // ... rest of existing code ...
}
```

### Step 5: Export Function Integration

Update your post/export function to include video editor settings:

```javascript
async function postStory() {
    // If video editor was used, get the settings
    if (videoEditor && isVideo) {
        const editorSettings = await videoEditor.exportVideo();

        // Apply the settings to textElements
        textElements = editorSettings.textElements;

        // Note: Speed and volume would need server-side processing
        // or FFmpeg.wasm for actual video re-encoding
    }

    // ... rest of your existing post logic ...
}
```

## Features Included

### 1. Timeline with Scrubber
- Drag to scrub through video
- Shows current time
- Visual timeline

### 2. Speed Controls
- 0.3x, 0.5x, 1x, 1.5x, 2x, 3x
- Instant playback speed change

### 3. Volume Controls
- Original video audio
- Background music (if added)
- Voiceover audio

### 4. Text Timing
- Set start/end time for each text
- Drag handles on timeline
- Text shows/hides automatically

### 5. Voiceover Recording
- Record audio over video
- Microphone access
- Mix with original audio

### 6. Mobile Optimized
- Large touch targets
- Swipe gestures
- Bottom sheet panels
- Smooth animations

## Usage Flow

1. User uploads video
2. User adds text elements
3. User clicks "Advanced Edit" button
4. Video editor opens full screen
5. User can:
   - Adjust playback speed
   - Set text timing (when text appears/disappears)
   - Record voiceover
   - Adjust volume levels
   - Scrub through timeline
6. User clicks "Done"
7. Settings are saved
8. Video is posted with all edits

## Technical Notes

### Video Re-encoding
The current implementation adjusts **playback** settings (speed, volume, text timing). To actually re-encode the video with these changes embedded, you would need:

**Option A: Server-side processing (recommended)**
- Send video + settings to server
- Use FFmpeg to re-encode
- Return edited video URL

**Option B: Client-side with FFmpeg.wasm**
- Load FFmpeg.wasm library
- Process video in browser
- Slower but no server needed

### Text Timing Storage
Text elements now have `startTime` and `endTime` properties:

```javascript
{
    content: "Hello!",
    x: 540,
    y: 960,
    size: 48,
    color: "white",
    startTime: 0,      // seconds
    endTime: 3.5,      // seconds
    visible: true/false // calculated based on current time
}
```

### Voiceover Track
When voiceover is recorded, it's stored as a blob URL. To use it:
- Mix with original audio during playback
- Send to server for final mixing
- Or use Web Audio API for real-time mixing

## Browser Compatibility

**Required APIs:**
- MediaRecorder (voiceover)
- getUserMedia (microphone)
- Canvas 2D (text rendering)
- HTML5 Video (playback)

**Supported Browsers:**
- Chrome/Edge 90+
- Safari 14+
- Firefox 88+
- Mobile browsers (iOS 14+, Android Chrome)

## File Sizes

- video-editor.css: ~12 KB
- video-editor.js: ~20 KB
- video-editor-ui.html: ~8 KB
- **Total: ~40 KB**

Very lightweight and mobile-optimized!

## Customization

### Change Colors
Edit `video-editor.css` and replace `#B39FFF` (purple) with your brand color.

### Add More Speed Options
In `video-editor-ui.html`, add more buttons to the speed panel:

```html
<button class="speed-option" data-speed="0.25" onclick="videoEditor.setPlaybackSpeed(0.25)">0.25x</button>
```

### Change Timeline Height
Edit `.editor-timeline-container` max-height in CSS.

## Troubleshooting

**Video editor doesn't open:**
- Check that all files are loaded (check Network tab)
- Verify video source is valid
- Check console for errors

**Text timing doesn't work:**
- Ensure textElements array has startTime/endTime
- Check that video duration is loaded
- Verify timeline is rendering

**Voiceover not recording:**
- Check microphone permissions
- Try HTTPS (required for getUserMedia)
- Check browser compatibility

## Next Steps

After integration, you can enhance with:
1. Video trimming (requires FFmpeg)
2. Multiple clips (requires video stitching)
3. Transitions between clips
4. More audio effects
5. Filters applied to video
6. Animated text (fade in/out)
