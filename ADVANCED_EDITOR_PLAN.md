# Advanced Multi-Track Video Editor - Implementation Plan

## Vision
Create a **TikTok/CapCut-style advanced editor** with full multi-track timeline support for splicing videos, audio, and text.

## Current State
- ✅ Single video playback
- ✅ Text elements with basic timing
- ✅ Speed/volume controls
- ✅ Voiceover recording
- ❌ All text on one track (not separate layers)
- ❌ Cannot add multiple videos
- ❌ Cannot add multiple audio tracks
- ❌ Cannot drag blocks to move them

## Target State (Advanced Editor)

### Timeline Structure
```
┌─────────────────────────────────────────┐
│ Video Track 1  [====clip1====][==clip2==] │ ← Main video layer
│ Video Track 2      [===clip3===]          │ ← PIP/overlay videos
├─────────────────────────────────────────┤
│ Audio Track 1  [=====music=====]          │ ← Background music
│ Audio Track 2  [==voiceover==]            │ ← Narration
│ Audio Track 3       [==sfx==]             │ ← Sound effects
├─────────────────────────────────────────┤
│ Text Layer 1   [==Hello!==]               │ ← Text 1
│ Text Layer 2        [===Bye===]           │ ← Text 2
│ Text Layer 3   [==Subscribe==]            │ ← Text 3
└─────────────────────────────────────────┘
   0:00    0:05    0:10    0:15    0:20
```

### Features to Implement

#### 1. Multi-Track System ⭐
**Priority: HIGH**

- [x] Separate visual track for each element
- [x] Each track has its own lane
- [x] Tracks stack vertically
- [x] Color-coded by type:
  - 🎬 Video: Blue
  - 🎵 Audio: Green
  - 📝 Text: Purple

#### 2. Add Buttons
**Priority: HIGH**

```
[+ Video] [+ Audio] [+ Text] buttons at top of timeline
```

- **+ Video**: Upload additional video clip
- **+ Audio**: Upload audio file (MP3, WAV, etc.)
- **+ Text**: Add new text element

#### 3. Drag & Drop Blocks ⭐
**Priority: HIGH**

- Drag entire block horizontally to move in time
- Snap to grid (optional)
- Show time tooltip while dragging
- Cannot overlap videos (auto-push)
- Can overlap text/audio

#### 4. Trim/Split Functionality
**Priority: MEDIUM**

- Click on clip → scissors icon appears
- Split at playhead position
- Trim start/end with handles (already have)
- Delete clip button

#### 5. Video Splicing
**Priority: HIGH**

Video clips play sequentially:
```
[Video 1: 0-5s] [Video 2: 5-10s] [Video 3: 10-15s]
```

- Upload multiple videos
- Arrange in order
- Automatic or manual transitions
- Total duration = sum of all clips

#### 6. Audio Mixing
**Priority: MEDIUM**

Multiple audio tracks play simultaneously:
```
Music:      [====================]
Voiceover:     [=======]  [=======]
SFX:        [pop]  [whoosh]  [bang]
```

- Independent volume for each track
- Fade in/out controls
- Mute/solo buttons per track

#### 7. Track Controls
**Priority: MEDIUM**

Each track has:
- **Lock** 🔒: Prevent editing
- **Visible** 👁️: Show/hide on preview
- **Mute** 🔇: Mute audio (for audio/video tracks)
- **Delete** 🗑️: Remove entire track

#### 8. Timeline Navigation
**Priority: HIGH**

- Zoom in/out (see more detail or overview)
- Scroll horizontally for long videos
- Snap to clips
- Time markers (0:00, 0:05, 0:10, etc.)

## Implementation Strategy

### Phase 1: Core Multi-Track Structure (2-3 hours)
**Goal:** Get basic multi-track timeline working

1. **Update Data Model**
   ```javascript
   {
       videoTracks: [
           { id, src, startTime, endTime, volume, speed }
       ],
       audioTracks: [
           { id, src, startTime, endTime, volume, fadeIn, fadeOut }
       ],
       textLayers: [
           { id, content, startTime, endTime, x, y, style, ... }
       ]
   }
   ```

2. **Redesign Timeline UI**
   - Separate container for each track type
   - Track headers with labels
   - Color-coded blocks
   - Each track is its own row

3. **Render Functions**
   - `renderVideoTracks()`
   - `renderAudioTracks()`
   - `renderTextLayers()`
   - `renderTimeline()` calls all three

### Phase 2: Add Functionality (1-2 hours)
**Goal:** Allow adding new clips

1. **Add Buttons UI**
   ```html
   <div class="timeline-add-buttons">
       <button onclick="addVideoClip()">
           <i class="bi bi-film"></i> + Video
       </button>
       <button onclick="addAudioClip()">
           <i class="bi bi-music-note"></i> + Audio
       </button>
       <button onclick="addTextLayer()">
           <i class="bi bi-fonts"></i> + Text
       </button>
   </div>
   ```

2. **File Upload Handlers**
   - Open file picker for video/audio
   - Add to appropriate track array
   - Re-render timeline
   - Update total duration

3. **Text Creator**
   - Modal/panel to create new text
   - Input content, style, position
   - Add to textLayers array

### Phase 3: Drag & Drop (2-3 hours)
**Goal:** Move blocks around timeline

1. **Draggable Blocks**
   - Detect mousedown on block (not handles)
   - Track mouse movement
   - Update startTime/endTime
   - Maintain duration
   - Re-render in real-time

2. **Snap Behavior**
   - Snap to other clips
   - Snap to playhead
   - Snap to time markers
   - Visual snap indicator

3. **Overlap Handling**
   - Videos: auto-push next clip
   - Audio/Text: allow overlap
   - Show warning if overlap occurs

### Phase 4: Video Composition (3-4 hours)
**Goal:** Actually splice videos together

1. **Sequential Playback**
   - When video 1 ends, play video 2
   - Update canvas to show current clip
   - Handle transitions

2. **Canvas Management**
   - Draw current video frame
   - Overlay text from visible layers
   - Handle multiple video sources

3. **Export Logic**
   - Calculate which clips are active at each time
   - Render appropriate content
   - Mix audio tracks

### Phase 5: Polish & UX (2-3 hours)
**Goal:** Make it feel professional

1. **Visual Feedback**
   - Hover states on blocks
   - Drag preview/ghost
   - Time tooltips
   - Loading states

2. **Track Management**
   - Add/remove tracks
   - Reorder tracks (drag tracks up/down)
   - Track height adjustment

3. **Keyboard Shortcuts**
   - Space: Play/Pause
   - Delete: Remove selected clip
   - Ctrl+Z: Undo
   - Arrow keys: Nudge clip

## Technical Architecture

### New Data Structure
```javascript
class AdvancedVideoEditor {
    constructor() {
        this.projectDuration = 0; // Total project length
        this.videoTracks = [];    // Array of video clip objects
        this.audioTracks = [];    // Array of audio clip objects
        this.textLayers = [];     // Array of text objects
        this.selectedClip = null; // Currently selected clip
        this.playheadTime = 0;    // Current playback position
    }

    // Core methods
    addVideoClip(file) { }
    addAudioClip(file) { }
    addTextLayer(textData) { }
    deleteClip(type, id) { }
    moveClip(type, id, newStartTime) { }
    trimClip(type, id, newStart, newEnd) { }

    // Playback
    play() { }
    pause() { }
    seek(time) { }

    // Rendering
    renderTimeline() { }
    renderFrame(time) { // Draw current frame to canvas }

    // Export
    exportProject() { // Return all data for server processing }
}
```

### File Structure
```
frontend/
  advanced-video-editor/
    advanced-editor.js       (main editor class)
    timeline-renderer.js     (timeline UI)
    clip-manager.js          (add/remove/move clips)
    playback-engine.js       (video playback logic)
    advanced-editor.css      (styles)
    advanced-editor-ui.html  (HTML structure)
```

## UI Mockup

```
┌──────────────────────────────────────────────────────────────┐
│ ← Cancel          Advanced Video Editor             Done →   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│                     VIDEO PREVIEW                             │
│                  (with text overlays)                         │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│ [▶️ Play]  0:05 / 0:30  [Speed ▼] [🔊 100%]                   │
├──────────────────────────────────────────────────────────────┤
│ [+ Video] [+ Audio] [+ Text]                    [Zoom: ▬▬●]  │
├──────────────────────────────────────────────────────────────┤
│ 0:00        0:05        0:10        0:15        0:20         │
│ ├───────────┼───────────┼───────────┼───────────┼────────    │
│ │ Playhead                                                    │
│ │                                                             │
│ 🎬 Video 1  ████████████████████████████████░░░░░░░░░░░      │
│ 🎬 Video 2  ░░░░░░░░░░░░░░░░░░░░████████████████              │
│                                                               │
│ 🎵 Music    ██████████████████████████████████████████        │
│ 🎵 Voice    ░░░░░░░████████████░░░░░████████░░░░░░░░░░        │
│                                                               │
│ 📝 Text 1   ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░        │
│ 📝 Text 2   ░░░░░░░░░░░░░░███████████░░░░░░░░░░░░░░░░        │
│ 📝 Text 3   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██████████░░        │
└──────────────────────────────────────────────────────────────┘
```

## CSS Classes

```css
/* Track containers */
.timeline-section {
    /* Video, Audio, or Text section */
}

.timeline-section-header {
    /* "Videos", "Audio", "Text" label */
}

.timeline-track {
    /* Individual track row */
    height: 50px;
}

.timeline-track-controls {
    /* Lock, Visible, Mute buttons */
}

/* Clips */
.timeline-clip {
    /* Base clip style */
    position: absolute;
    border-radius: 6px;
    cursor: move;
}

.timeline-clip.video {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.timeline-clip.audio {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.timeline-clip.text {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.timeline-clip.selected {
    box-shadow: 0 0 0 3px #fff;
}

.timeline-clip:hover {
    filter: brightness(1.2);
}
```

## Example Usage

```javascript
// Initialize advanced editor
const editor = new AdvancedVideoEditor();

// User uploads first video
editor.addVideoClip(videoFile1);

// User adds background music
editor.addAudioClip(musicFile);

// User adds text
editor.addTextLayer({
    content: "Welcome!",
    startTime: 0,
    endTime: 3,
    x: 540,
    y: 960,
    style: "outline"
});

// User uploads second video to splice after first
editor.addVideoClip(videoFile2);

// Move second video to start at 5 seconds
editor.moveClip('video', videoClip2.id, 5);

// Export for server processing
const project = editor.exportProject();
// Returns: all clips, tracks, timing, ready for FFmpeg
```

## Server-Side Processing

To actually create the final video, need FFmpeg on server:

```bash
# Pseudo-code for server
ffmpeg \
  -i video1.mp4 \
  -i video2.mp4 \
  -i music.mp3 \
  -i voiceover.webm \
  -filter_complex "
    [0:v][1:v]concat=n=2:v=1[v];
    [2:a][3:a]amix=inputs=2[a];
    [v]drawtext=text='Welcome':x=540:y=960:enable='between(t,0,3)'[vout]
  " \
  -map [vout] -map [a] \
  output.mp4
```

## Estimated Total Time
- **Phase 1:** 2-3 hours (core structure)
- **Phase 2:** 1-2 hours (add buttons)
- **Phase 3:** 2-3 hours (drag & drop)
- **Phase 4:** 3-4 hours (video composition)
- **Phase 5:** 2-3 hours (polish)

**Total: 10-15 hours of development**

## MVP (Minimum Viable Product)
If time is limited, prioritize:

1. ✅ Multi-layer text tracks (each text separate)
2. ✅ Add text button
3. ✅ Drag text blocks to move them
4. ⏸️ Multiple videos (Phase 2)
5. ⏸️ Multiple audio (Phase 2)

## Decision Points

### Option A: Full Rewrite
- Start fresh with new architecture
- Cleaner code
- Takes longer
- More features

### Option B: Incremental Update
- Enhance existing editor
- Faster to ship
- Limited by current structure
- Easier migration

**Recommendation:** Option B for now (get multi-layer text working), then Option A when ready for full video splicing.

## Next Steps

1. **Immediate:** Implement multi-layer text tracks (1-2 hours)
2. **Short-term:** Add text button + drag blocks (1-2 hours)
3. **Medium-term:** Plan full rewrite for video/audio support (when ready)

Ready to start? Let's begin with multi-layer text tracks! 🚀
