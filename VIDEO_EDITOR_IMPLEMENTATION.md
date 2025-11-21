# TikTok-Style Video Editor Implementation Plan

## Overview
Adding comprehensive video editing features to create-story.html for mobile-only interface.

## Features to Implement

### 1. Video Editor Modal (Full Screen)
- Replaces current simple edit tools when editing video
- Mobile-first, touch-optimized interface
- Bottom timeline with video scrubber

### 2. Timeline Component
- Visual timeline showing video duration
- Draggable scrubber to preview frames
- Text element tracks (show when text appears/disappears)
- Audio waveform visualization
- Split/cut markers

### 3. Speed Controls
- 0.3x, 0.5x, 1x, 1.5x, 2x, 3x speeds
- Apply to entire video or sections
- Visual indicator on timeline

### 4. Trimming & Splicing
- Set start/end trim markers
- Cut/split video at current position
- Delete segments
- Rearrange clips on timeline

### 5. Text Timing
- Each text element has start/end time
- Drag handles on timeline to adjust duration
- Preview which texts show at current time
- Easy tap to edit timing

### 6. Voiceover Recording
- Record audio over video
- Waveform visualization
- Volume control for voiceover
- Mix with original audio

### 7. Volume/Audio Controls
- Original video volume slider
- Background music volume
- Voiceover volume
- Mute toggle

### 8. Additional Controls
- Filters (applied to video)
- Brightness/contrast
- Crop/rotate
- Effects

## Technical Implementation

### HTML Structure
```html
<!-- Video Editor Modal (Full Screen) -->
<div id="video-editor" style="display: none;">
  <!-- Top Bar -->
  <div class="editor-header">
    <button>Back</button>
    <span>Edit Video</span>
    <button>Done</button>
  </div>

  <!-- Video Preview -->
  <div class="editor-preview">
    <video id="editor-video"></video>
    <canvas id="editor-canvas"></canvas>
    <!-- Text overlays render here -->
  </div>

  <!-- Timeline (Bottom) -->
  <div class="editor-timeline">
    <!-- Video track -->
    <div class="timeline-track video-track">
      <!-- Video clips -->
    </div>

    <!-- Text tracks -->
    <div class="timeline-track text-track">
      <!-- Text timing bars -->
    </div>

    <!-- Audio track -->
    <div class="timeline-track audio-track">
      <!-- Waveform -->
    </div>

    <!-- Scrubber -->
    <div class="timeline-scrubber"></div>

    <!-- Time indicator -->
    <div class="timeline-time">0:00 / 0:15</div>
  </div>

  <!-- Controls -->
  <div class="editor-controls">
    <button>Speed</button>
    <button>Trim</button>
    <button>Split</button>
    <button>Volume</button>
    <button>Voiceover</button>
    <button>Text Timing</button>
  </div>
</div>
```

### JavaScript Functions Needed
- `openVideoEditor()` - Opens editor with video
- `updateTimeline()` - Renders timeline tracks
- `setPlaybackSpeed(speed)` - Changes video speed
- `trimVideo(start, end)` - Trims video
- `splitVideo(time)` - Splits at position
- `addTextTiming(textId, start, end)` - Sets text display time
- `recordVoiceover()` - Records audio
- `updateVolume(track, volume)` - Adjusts audio levels
- `renderVideoWithEdits()` - Exports final video

### Mobile Optimizations
- Large touch targets (44px minimum)
- Swipe gestures for timeline scrubbing
- Bottom sheet modals for controls
- Haptic feedback on interactions
- Smooth 60fps animations
- Gesture-based zooming for timeline

## File Size Estimate
- HTML: ~500 lines
- CSS: ~800 lines
- JavaScript: ~2000 lines
- **Total: ~3300 lines**

## Implementation Priority
1. ✅ Timeline with scrubber (core feature)
2. ✅ Text timing controls (requested feature)
3. ✅ Speed controls (easy win)
4. ✅ Volume controls (easy win)
5. ✅ Voiceover recording (complex)
6. ⚠️ Trimming/splicing (complex - requires video re-encoding)
7. ⚠️ Multiple clips (very complex - requires video stitching)

## Notes
- Full splicing/stitching requires FFmpeg.wasm or server-side processing
- For now, focus on playback-time effects (speed, volume, timing)
- Can simulate trimming by setting playback start/end points
- True video re-encoding should be server-side for performance
